import path from 'path';

export const APP_DIR = process.cwd();
export const UPLOAD_DIR = process.env.NODE_UPLOAD_FILES
  ? path.join(APP_DIR, `${process.env.NODE_UPLOAD_FILES}`)
  : path.join(APP_DIR, 'uploads');
