let jobIdCounter = 0;

/**
 * A bounded concurrency worker pool.
 */
export class WorkerPool {
  /**
   * @param {Function} workerFactory Function that returns a new Worker instance
   * @param {number} maxConcurrency Maximum number of active workers
   * @param {number} timeoutMs Optional timeout to force terminate a worker
   */
  constructor(workerFactory, maxConcurrency = null, timeoutMs = 60000) {
    this.workerFactory = workerFactory;
    
    // Determine a sensible default concurrency limit
    const hw = typeof navigator !== 'undefined' && navigator.hardwareConcurrency 
                 ? navigator.hardwareConcurrency : 4;
    this.maxConcurrency = maxConcurrency || Math.max(1, Math.min(4, hw - 1));
    this.timeoutMs = timeoutMs;
    
    this.workers = [];      // { worker, activeJobId, timeoutId }
    this.queue = [];        // { id, type, payload, transfer, resolve, reject, onProgress, signal, abortHandler }
    this.activeJobs = new Map(); // id -> job details
  }

  /**
   * Dispatch a job to the worker pool.
   */
  dispatch(type, payload, options = {}) {
    return new Promise((resolve, reject) => {
      const id = `job_${++jobIdCounter}`;
      
      const job = {
        id,
        type,
        payload,
        transfer: options.transfer || [],
        resolve,
        reject,
        onProgress: options.onProgress,
        signal: options.signal,
      };

      if (job.signal) {
        if (job.signal.aborted) {
          return reject(new Error('CANCELLED'));
        }
        
        job.abortHandler = () => {
          this.cancelJob(id);
        };
        job.signal.addEventListener('abort', job.abortHandler);
      }

      this.queue.push(job);
      this.activeJobs.set(id, job);
      
      this.processQueue();
    });
  }

  cancelJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) return; // already done or cancelled

    if (job.signal && job.abortHandler) {
      job.signal.removeEventListener('abort', job.abortHandler);
    }
    
    this.activeJobs.delete(jobId);
    
    // Is it in the queue?
    const queueIndex = this.queue.findIndex(j => j.id === jobId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
      job.reject(new Error('CANCELLED'));
      return;
    }

    // It's currently running on a worker
    const workerObj = this.workers.find(w => w.activeJobId === jobId);
    if (workerObj) {
      // Send cancel message
      workerObj.worker.postMessage({ id: jobId, type: 'CANCEL' });
      // We don't immediately resolve/reject here; we let the worker return CANCELLED status,
      // OR we just reject it proactively. Proactively rejecting is safer for the UI.
      job.reject(new Error('CANCELLED'));
      
      // The worker will eventually finish and return CANCELLED, freeing the slot.
      // But to be robust against hung workers, we could optionally terminate it immediately.
      // Since C2PA WASM might hang, let's aggressively terminate if cancelled to free resources.
      this.terminateWorker(workerObj);
    }
  }

  terminateWorker(workerObj) {
    if (workerObj.timeoutId) clearTimeout(workerObj.timeoutId);
    workerObj.worker.terminate();
    
    // Remove from array
    this.workers = this.workers.filter(w => w !== workerObj);
    
    // Pick up next task
    this.processQueue();
  }

  processQueue() {
    if (this.queue.length === 0) return;

    // Find an idle worker
    let workerObj = this.workers.find(w => w.activeJobId === null);

    // If no idle worker, try to spawn one
    if (!workerObj && this.workers.length < this.maxConcurrency) {
      const worker = this.workerFactory();
      workerObj = { worker, activeJobId: null, timeoutId: null };
      
      worker.onmessage = (e) => this.handleMessage(workerObj, e.data);
      worker.onerror = (err) => {
        if (workerObj.activeJobId) {
           const job = this.activeJobs.get(workerObj.activeJobId);
           if (job) job.reject(new Error(`WORKER_ERROR: ${err.message}`));
           this.activeJobs.delete(workerObj.activeJobId);
        }
        this.terminateWorker(workerObj);
      };
      
      this.workers.push(workerObj);
    }

    if (!workerObj) {
      // Pool is full, wait
      return;
    }

    // We have a worker, grab next valid job
    let job;
    while (this.queue.length > 0) {
      job = this.queue.shift();
      if (this.activeJobs.has(job.id)) {
        break; // found a valid job
      }
      job = null;
    }

    if (!job) return; // queue was full of cancelled jobs

    workerObj.activeJobId = job.id;

    if (this.timeoutMs) {
      workerObj.timeoutId = setTimeout(() => {
        const j = this.activeJobs.get(workerObj.activeJobId);
        if (j) j.reject(new Error('TIMEOUT'));
        this.activeJobs.delete(workerObj.activeJobId);
        this.terminateWorker(workerObj);
      }, this.timeoutMs);
    }

    try {
      workerObj.worker.postMessage(
        { id: job.id, type: 'START', action: job.type, payload: job.payload },
        job.transfer
      );
    } catch (err) {
      // Transfer failed (e.g. object not transferable)
      job.reject(err);
      this.finishJob(workerObj, job.id);
    }
  }

  handleMessage(workerObj, data) {
    const { id, type, result, error, stage } = data;
    const job = this.activeJobs.get(id);

    if (!job) {
      // Job might have been cancelled and we just received a straggler message
      if (type === 'COMPLETE' || type === 'ERROR' || type === 'CANCELLED') {
        this.finishJob(workerObj, id);
      }
      return;
    }

    if (type === 'PROGRESS') {
      if (job.onProgress) job.onProgress({ stage, ...result });
    } else if (type === 'COMPLETE') {
      job.resolve(result);
      this.finishJob(workerObj, id);
    } else if (type === 'ERROR') {
      job.reject(new Error(error || 'WORKER_ERROR'));
      this.finishJob(workerObj, id);
    } else if (type === 'CANCELLED') {
      job.reject(new Error('CANCELLED'));
      this.finishJob(workerObj, id);
    }
  }

  finishJob(workerObj, jobId) {
    if (workerObj.activeJobId === jobId) {
      workerObj.activeJobId = null;
      if (workerObj.timeoutId) {
        clearTimeout(workerObj.timeoutId);
        workerObj.timeoutId = null;
      }
    }
    
    const job = this.activeJobs.get(jobId);
    if (job) {
      if (job.signal && job.abortHandler) {
        job.signal.removeEventListener('abort', job.abortHandler);
      }
      this.activeJobs.delete(jobId);
    }

    // Trigger next job
    this.processQueue();
  }
  
  // Cleanly terminate all workers (for teardown)
  terminateAll() {
    for (const w of this.workers) {
      w.worker.terminate();
    }
    this.workers = [];
    this.queue = [];
    this.activeJobs.clear();
  }
}
