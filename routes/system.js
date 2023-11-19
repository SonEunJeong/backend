const express = require('express');
const router = express.Router();
const { sequelize,System } = require('../model/db');

router.get('/list', async function (req, res) {
  console.log("system::: /base url :: " +  req.baseUrl);
  console.log("system::: /list");
  console.log("req.param::: >>> " + req.params);
    try {
      const system = await System.findAll();
      res.json({result:system});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while fetching system' });
    }
  });
  
  router.put('/update', async function (req, res) {
    try {
      const system = await System.upsert(req.body);
      res.json({result: system});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while updating system' });
    }
  });
    
  module.exports = router;