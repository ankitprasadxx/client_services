const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();
const { ingestFile } = require('../services/pythonBridge');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'python', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const ts   = Date.now();
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${base}_${ts}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// POST /api/upload
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filepath = req.file.path;

  try {
    const result = await ingestFile(filepath);
    res.json(result);
  } catch (err) {
    // Clean up file on error
    try { fs.unlinkSync(filepath); } catch (_) {}

    console.error('[upload] Error:', err.message);
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Python service is not running. Start it with: python python/app.py'
      });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;