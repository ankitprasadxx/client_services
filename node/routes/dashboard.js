const express = require('express');
const router  = express.Router();
const ds      = require('../services/dataService');

// GET /api/dashboard/overview?client=&category=&location=
router.get('/overview', (req, res) => {
  try {
    const filters = {
      client:   req.query.client   || '',
      category: req.query.category || '',
      location: req.query.location || '',
    };
    // Remove empty strings
    Object.keys(filters).forEach(k => { if (!filters[k]) delete filters[k]; });
    const data = ds.getOverview(filters);
    res.json(data);
  } catch (e) {
    console.error('[dashboard/overview]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dashboard/employees?client=&category=&location=&level=&shift=&search=
router.get('/employees', (req, res) => {
  try {
    const filters = {
      client:   req.query.client   || '',
      category: req.query.category || '',
      location: req.query.location || '',
      level:    req.query.level    || '',
      shift:    req.query.shift    || '',
      search:   req.query.search   || '',
    };
    Object.keys(filters).forEach(k => { if (!filters[k]) delete filters[k]; });
    const data = ds.getEmployees(filters);
    res.json(data);
  } catch (e) {
    console.error('[dashboard/employees]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dashboard/client/:name
router.get('/client/:name', (req, res) => {
  try {
    const data = ds.getClientDetail(req.params.name);
    res.json(data);
  } catch (e) {
    console.error('[dashboard/client]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dashboard/shifts
router.get('/shifts', (req, res) => {
  try {
    const data = ds.getShiftData();
    res.json(data);
  } catch (e) {
    console.error('[dashboard/shifts]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dashboard/uploads
router.get('/uploads', (req, res) => {
  try {
    const data = ds.getUploadHistory();
    res.json(data);
  } catch (e) {
    console.error('[dashboard/uploads]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/dashboard/leads
router.get('/leads', (req, res) => {
  try {
    const data = ds.getLeadsData();
    res.json(data);
  } catch (e) {
    console.error('[dashboard/leads]', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;