import fs from 'fs';
import path from 'path';
import piexif from 'piexifjs';

const outDir = path.resolve(process.cwd(), 'tests', 'fixtures', 'realistic');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Minimal valid standard JPEG
const b64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const baseJpegDataUrl = 'data:image/jpeg;base64,' + b64;

// Case 1: iPhone 15 Pro with GPS Location and Personal / Camera info
const iphoneExifObj = {
  '0th': {
    [piexif.ImageIFD.Make]: 'Apple',
    [piexif.ImageIFD.Model]: 'iPhone 15 Pro',
    [piexif.ImageIFD.Software]: '17.5.1',
    [piexif.ImageIFD.DateTime]: '2024:08:15 14:30:22',
    [piexif.ImageIFD.Artist]: 'Alex Traveler',
    [piexif.ImageIFD.Orientation]: 1,
    [piexif.ImageIFD.XResolution]: [72, 1],
    [piexif.ImageIFD.YResolution]: [72, 1],
  },
  'Exif': {
    [piexif.ExifIFD.DateTimeOriginal]: '2024:08:15 14:30:22',
    [piexif.ExifIFD.DateTimeDigitized]: '2024:08:15 14:30:22',
    [piexif.ExifIFD.LensModel]: 'iPhone 15 Pro back triple camera 6.86mm f/1.78',
    [piexif.ExifIFD.ColorSpace]: 1,
    [piexif.ExifIFD.ISOSpeedRatings]: 64,
  },
  'GPS': {
    [piexif.GPSIFD.GPSLatitudeRef]: 'N',
    [piexif.GPSIFD.GPSLatitude]: [[37, 1], [46, 1], [3000, 100]], // 37.775 deg
    [piexif.GPSIFD.GPSLongitudeRef]: 'W',
    [piexif.GPSIFD.GPSLongitude]: [[122, 1], [25, 1], [1000, 100]], // -122.419 deg
    [piexif.GPSIFD.GPSAltitudeRef]: 0,
    [piexif.GPSIFD.GPSAltitude]: [15, 1],
    [piexif.GPSIFD.GPSDateStamp]: '2024:08:15',
  }
};

const iphoneExifBytes = piexif.dump(iphoneExifObj);
const iphoneDataUrl = piexif.insert(iphoneExifBytes, baseJpegDataUrl);
const iphoneBuffer = Buffer.from(iphoneDataUrl.split(',')[1], 'base64');
fs.writeFileSync(path.join(outDir, 'iphone_gps_photo.jpg'), iphoneBuffer);

// Case 2: DSLR Canon EOS Portrait with Orientation = 6 (Rotated 90 CW) and Copyright
const canonExifObj = {
  '0th': {
    [piexif.ImageIFD.Make]: 'Canon',
    [piexif.ImageIFD.Model]: 'Canon EOS R6 Mark II',
    [piexif.ImageIFD.Orientation]: 6,
    [piexif.ImageIFD.Artist]: 'Studio Photographer',
    [piexif.ImageIFD.Copyright]: '© 2024 Studio Pro',
  },
  'Exif': {
    [piexif.ExifIFD.DateTimeOriginal]: '2024:07:04 11:15:00',
    [piexif.ExifIFD.LensModel]: 'RF85mm F1.2 L USM',
    [piexif.ExifIFD.ColorSpace]: 1,
    [piexif.ExifIFD.ISOSpeedRatings]: 100,
  }
};
const canonExifBytes = piexif.dump(canonExifObj);
const canonDataUrl = piexif.insert(canonExifBytes, baseJpegDataUrl);
const canonBuffer = Buffer.from(canonDataUrl.split(',')[1], 'base64');
fs.writeFileSync(path.join(outDir, 'canon_eos_portrait.jpg'), canonBuffer);

// Case 3: Clean PNG Screenshot
const validPng = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 
  0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x04, 0x08, 0x02, 0x00, 0x00, 0x00, 0x26, 0x93, 0x0F, 
  0x12, 0x00, 0x00, 0x00, 0x0F, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 
  0x00, 0x00, 0x0C, 0x00, 0x05, 0x1C, 0x02, 0x40, 0xD4, 0x9F, 0x56, 0x00, 0x00, 0x00, 0x00, 0x49, 
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);
fs.writeFileSync(path.join(outDir, 'clean_screenshot.png'), validPng);

// Case 4: Malformed JPEG (invalid header)
const malformedJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0xFF, 0xFF, 0x00, 0x00]);
fs.writeFileSync(path.join(outDir, 'corrupted_image.jpg'), malformedJpeg);

// Case 5: Unsupported format (.pdf)
fs.writeFileSync(path.join(outDir, 'unsupported_file.pdf'), Buffer.from('%PDF-1.4 dummy file content'));

console.log('Realistic test fixtures created successfully in:', outDir);
