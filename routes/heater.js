const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const { sequelize,Building,Heater } = require('../model/db');

router.get('/floor/:id', async function (req, res) {
    try {
      const floor = await Building.findOne({ where: { floorId: req.params.id } });
  
      if (!floor) {
        res.status(401).json({ error: 'Not found floor.' });
      
      } else {
        // Passwords match! Create a session, or issue a token, etc...
        res.json(floor);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred during get floor.' });
    } 
  });

router.get('/getFloorList', async function (req, res) {
    try {
      // Building과 Heater를 조인하여 floorId로 그룹핑하여 heater 갯수 summary 컬럼 포함 조회
      const floors = await sequelize.query(
        `SELECT B.FLOOR_ID, 
          B.SECTION_ID, 
          B.FLOOR_NM, 
          B.SECTION_NM, 
         (B.FLOOR_ID || B.SECTION_ID) AS FULL_ID,
          COUNT(H.DEVICE_ID) AS H_CNT 
        FROM TB_BUILD B LEFT OUTER JOIN TB_HEATER H 
          ON B.FLOOR_ID = H.FLOOR_ID 
        GROUP BY B.FLOOR_ID, B.SECTION_ID ORDER BY B.FLOOR_NM, B.SECTION_NM`,
        {
          type: Sequelize.QueryTypes.SELECT
        }
      ); 
       
      res.json(floors);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while fetching floors' });
    }
  });
  
  router.put('/saveFloor/:id', async function (req, res) {
    try {
      const builing = await Building.upsert(req.body);
      res.json({result: builing});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while saveFloor - '+error.message });
    }
  });
  
  router.delete('/deleteFloor/:id', async function (req, res) {
    try {
      await Building.destroy({
        where: {
          floorId: req.params.id
        }
      });
      res.json({result: req.params.id+' Floor deleted'});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while deleting Floor' });
    }
  });

  // floor list로 upsert or delete
  router.put('/saveFloorList/:cmd', async function (req, res) {
    try {
      let params = req.body;
      let rtn;

      if( params[0] ){
        params.forEach(floor => {
          // floorId 99는 제외
          if( floor.FLOOR_ID === '99' ) return;

          if(req.params.cmd === "U"){
            rtn = Building.upsert(floor)

          }else{
            // 삭제시 heaterCnt 존재시 해당 floorId의 히터를 모두 99로 변경
            if( floor.heaterCnt > 0 ){
              rtn = sequelize.query(
                "UPDATE TB_HEATER SET FLOOR_ID = '99' WHERE FLOOR_ID = :floorId",
                {
                  replacements: { floorId: floor.FLOOR_ID }, // 바인딩
                  type: Sequelize.QueryTypes.UPDATE
                }
              );
            }

            rtn =  Building.destroy({ where: { FLOOR_ID: floor.FLOOR_ID, SECTION_ID: floor.SECTION_ID } })
          }
        });

      }else{
        // floorId 99는 제외
        if( params.floorId === '99' ) return;

        if(req.params.cmd === "U"){
          rtn = await Building.upsert(params)
        }else{
          // 삭제시 heaterCnt 존재시 해당 floorId의 히터를 모두 99로 변경
          if( params.heaterCnt > 0 ){
            rtn = sequelize.query(
              "UPDATE TB_HEATER SET FLOOR_ID = '99' WHERE FLOOR_ID = :floorId",
              {
                replacements: { floorId: params.FLOOR_ID }, // 바인딩
                type: Sequelize.QueryTypes.UPDATE
              }
            );
          }

          rtn =  Building.destroy({ where: { FLOOR_ID: floor.FLOOR_ID, SECTION_ID: floor.SECTION_ID } });

        }
      }

      res.json({result: rtn});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while saveFloor - '+error.message });
    }
  });


  /*********************** 히터 CRUD *************************************/
   router.post('/getHeaterList', async function (req, res) {
  //  router.get('/getHeaterList', async function (req, res) {
    try {
      let params = req.body;
      const floorId = params.FLOOR_ID
      const sectionId = params.SECTION_ID;
      const heaters = await sequelize.query(
        `SELECT H.DEVICE_ID, 
            B.FLOOR_ID, 
            B.SECTION_ID, 
            B.FLOOR_NM, 
            B.SECTION_NM, 
            CASE WHEN H.STATUS == 0 THEN 'OFF' 
            WHEN H.STATUS == 1 THEN 'ON' 
            WHEN H.STATUS == 2 THEN '단선' 
            WHEN H.STATUS == 3 THEN '과전류' 
            WHEN H.STATUS == 4 THEN '온도센서' 
            WHEN H.STATUS == 5 THEN '위치인식'
            WHEN H.STATUS == 6 THEN '통신오류'
            END STATUS_TEXT,
            H.STATUS, 
            H.CURRENT, 
            H.ON_TEMP, 
            H.CURR_TEMP, 
            H.OFF_TEMP, 
            H.createdAt, 
            H.updatedAt 
        FROM TB_HEATER H LEFT OUTER JOIN TB_BUILD B
          ON H.FLOOR_ID = B.FLOOR_ID
          AND H.SECTION_ID = B.SECTION_ID
        WHERE H.FLOOR_ID LIKE :floorId AND H.SECTION_ID LIKE :sectionId
        ORDER BY DEVICE_ID ASC`,
        {
          replacements: { floorId: "%"+floorId+"%", sectionId: "%"+sectionId+"%" }, // 바인딩
          type: Sequelize.QueryTypes.SELECT,

         }
      );
      res.json(heaters);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while fetching heaters' });
    }
  });
  
  router.post('/getNewHeaterList', async function (req, res) {
    //  router.get('/getHeaterList', async function (req, res) {
      try {
        let params = req.body;
        const floorId = params.FLOOR_ID
        const sectionId = params.SECTION_ID;
        const lastDate = params.LAST_DATE;
        const heaters = await sequelize.query(
          `SELECT H.DEVICE_ID, 
              B.FLOOR_ID, 
              B.SECTION_ID, 
              B.FLOOR_NM, 
              B.SECTION_NM, 
              CASE WHEN H.STATUS == 0 THEN 'OFF' 
              WHEN H.STATUS == 1 THEN 'ON' 
              WHEN H.STATUS == 2 THEN '단선' 
              WHEN H.STATUS == 3 THEN '과전류' 
              WHEN H.STATUS == 4 THEN '온도센서' 
            WHEN H.STATUS == 5 THEN '위치인식'
            WHEN H.STATUS == 6 THEN '통신오류'
              END STATUS_TEXT,
              H.STATUS, 
              H.CURRENT, 
              H.ON_TEMP, 
              H.CURR_TEMP, 
              H.OFF_TEMP, 
              H.createdAt, 
              H.updatedAt 
          FROM TB_HEATER H LEFT OUTER JOIN TB_BUILD B
            ON H.FLOOR_ID = B.FLOOR_ID
            AND H.SECTION_ID = B.SECTION_ID
          WHERE H.FLOOR_ID LIKE :floorId AND H.SECTION_ID LIKE :sectionId
          AND strftime('%Y-%m-%d %H:%M:%S', H.createdAt, 'localtime') > :lastDate 
          ORDER BY DEVICE_ID ASC`,
          {
            replacements: { floorId: "%"+floorId+"%", sectionId: "%"+sectionId+"%", lastDate: lastDate }, // 바인딩
            type: Sequelize.QueryTypes.SELECT,
  
           }
        );
        res.json(heaters);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching heaters' });
      }
    });

  router.put('/saveHeater', async function (req, res) {
    try {
      let params = req.body;
      let rtn;
      if( params[0] ){
        params.forEach(async heater => {
          //rtn = Heater.upsert(heater);
          const heaters = await sequelize.query(`
            UPDATE TB_HEATER
              SET ON_TEMP = :onTemp,
              OFF_TEMP = :offTemp,
              COMMAND = (SELECT CASE WHEN ON_TEMP != :onTemp OR OFF_TEMP != :offTemp THEN '1' ELSE '0' END COMMAND
                            FROM TB_HEATER 
                          WHERE DEVICE_ID = :deviceId),
              updatedAt = CURRENT_TIMESTAMP
              WHERE DEVICE_ID = :deviceId
            `,
            {
              replacements: { onTemp: heater.ON_TEMP, offTemp: heater.OFF_TEMP, deviceId: heater.DEVICE_ID }, // 바인딩
              type: Sequelize.QueryTypes.SELECT,
             })
        });
      }
      res.json({result: rtn});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while save heater - '+error.message });
    }
  });
  
  router.delete('/deleteHeater/:heater', async function (req, res) {
    try{
      const deviceId = req.params.heater;
      const heaters = await sequelize.query(
        `DELETE FROM TB_HEATER WHERE DEVICE_ID IN (`+deviceId+`)`
    );
      res.json({result: req.params.id+' Floor deleted'});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while deleting Floor' });
    }
  });
  router.get('/updatecommand/:heater', async function (req, res) {
    try{
      const deviceId = req.params.heater;
      const heaters = await sequelize.query(`
        UPDATE TB_HEATER
          SET COMMAND = 2,
          STATUS = 5,
          updatedAt = CURRENT_TIMESTAMP
          WHERE DEVICE_ID = `+deviceId+`
      `
    );
    let stt =  setTimeout(async () => {
        const heaters = await Heater.update({COMMAND: 0}, {where:{DEVICE_ID: deviceId}});
    }, 30000);
    //clearTimeout(stt);
      res.json({result: deviceId});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while deleting Floor' });
    }
  });

  
  module.exports = router;