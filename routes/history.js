const express = require('express');
const router = express.Router();

const { Op ,Sequelize } = require("sequelize");
const { sequelize,  History, Heater } = require('../model/db');
const moment = require('moment');
//const { now } = require('sequelize/types/utils');

router.get('/getHistory/:from/:to', async (req, res) => {
  try {
    const { from, to } = req.params;
    
    // history 조회 쿼리를 from to 로 createAt 컬럼을 strfime('%Y-%m-%d') 사용하여 기간만큼 데이터 조회
    const results = await sequelize.query(`
      SELECT TB.createdAt,
        TB.DEVICE_ID,
        TB.ON_TEMP,
        TB.CURR_TEMP,
        TB.OFF_TEMP,
        TB.STATUS,
        CASE WHEN TH.STATUS == 0 THEN 'OFF' 
        WHEN TB.STATUS == 1 THEN 'ON' 
        WHEN TB.STATUS == 2 THEN '단선' 
        WHEN TB.STATUS == 3 THEN '과전류' 
        WHEN TB.STATUS == 4 THEN '온도센서' 
        WHEN TB.STATUS == 5 THEN '위치인식'
        WHEN TB.STATUS == 6 THEN '통신오류'
        END STATUS_TEXT
      FROM
          TB_HISTORY TB LEFT OUTER JOIN TB_HEATER TH
      ON TB.DEVICE_ID = TH.DEVICE_ID
      WHERE 
          strftime('%Y-%m-%d', TB.createdAt) >= :from
          AND strftime('%Y-%m-%d', TB.createdAt) <= :to        
      ORDER BY  
          TB.SEQ DESC  
    `, {  
      replacements: { from: from, to: to }, 
      type: Sequelize.QueryTypes.SELECT 
    }); 

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching files' });
  }
});

//최근 count개 데이터를 조회
router.get('/getHistory/:count', async (req, res) => {
  try {
    const { count } = req.params;
    console.log('--- count : ', count);
    
    const files = await History.findAll({
      limit: count,
      where: {
        STATUS: {
          //[Op.notIn]: [0, 1]
          [Op.or]: [0, 1, 2, 3, 4, 5]
        }
      },
      order: [['createdAt', 'DESC']]
    });
    res.json(files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching files' });
  }
});
//최근 수신데이터 및 평균온도, 총 전력량
router.get('/getNewHistory', async (req, res) => {
  try {
    const results = await sequelize.query(`
    SELECT ROUND(MIN(CURR_TEMP),1) AS lowest,
    ROUND(MAX(CURR_TEMP),1) AS highest,
    ROUND(AVG(CURR_TEMP), 1) AS average,
	  ROUND(sum(CURRENT), 1) AS CURRENT,
    MAX(createdAt) AS createdAt
    FROM TB_HISTORY  
WHERE strftime('%Y-%m-%d', createdAt) = strftime('%Y-%m-%d', 'now')
    `, {  
      type: Sequelize.QueryTypes.SELECT 
    }); 
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching files' });
  }
});

router.get('/getHistoryMonPower/:yyyymm', async (req, res) => {
  try {
    const { yyyymm } = req.params;

    // yyyymm 포함 -3개월을 to 로 설정
    const toDate = moment(yyyymm, 'YYYYMM').subtract(2, 'months').format('YYYYMM');
    console.log('--- toDate : ', toDate);
   

    const results = await sequelize.query(`
    WITH MONTH AS(
      SELECT strftime('%Y%m', date('now','start of month','-1 month')) as 'yyyymm'
      UNION
      SELECT strftime('%Y%m', date('now','start of month','-2 month')) as 'yyyymm'
      UNION
      SELECT strftime('%Y%m', date('now')) as 'yyyymm'
      )
      SELECT
      M.yyyymm,
      IFNULL(T.CURRENT, 0) AS CURRENT
      FROM MONTH M LEFT OUTER JOIN 
      (
      SELECT 
                strftime('%Y%m', day) AS yyyymm,
                SUM(maxPower) AS CURRENT 
            FROM
                (SELECT
                    DEVICE_ID,
                    date(createdAt) AS day,
                    MAX(CURRENT) AS maxPower
                FROM
                    TB_HISTORY
                WHERE
                    strftime('%Y%m', createdAt) > :toDate
                    AND strftime('%Y%m', createdAt) <= :yyyymm
                    AND STATUS NOT IN ('1', '5')
                GROUP BY
                    DEVICE_ID, 
                    day)
            GROUP BY
                 yyyymm
      ) T
      ON M.yyyymm = T.yyyymm
    `, {
      replacements: { toDate : toDate , yyyymm : yyyymm },
      type: Sequelize.QueryTypes.SELECT
    });

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching history' });
  }
});

router.post('/getAlertList', async(req, res) =>{
  try {
    const {from, to} = req.body;
    console.log("getAlertList >>>>>>>>>>>>>>>>>>>>>>>> " + from );
    // history 조회 쿼리를 from to 로 createAt 컬럼을 strfime('%Y-%m-%d') 사용하여 기간만큼 데이터 조회
    const results = await sequelize.query(`
    SELECT T.SEQ,
      T.DEVICE_ID,
      T.DT,
      T.PRE_DT,
      T.createdAt,
      T.updatedAt,
      T.DESC,
        CASE 
        WHEN T.STATUS != T.PRE_STATUS AND length(T.DESC) == 0 THEN true
        WHEN T.STATUS != T.PRE_STATUS AND length(T.DESC) > 0 THEN false
        WHEN T.STATUS == T.PRE_STATUS AND length(T.DESC) > 0 THEN false
        WHEN T.STATUS == T.PRE_STATUS AND length(T.DESC) == 0 THEN false
        END BLINK,
        T.STATUS,
        CASE WHEN T.STATUS == 0 THEN 'OFF' 
              WHEN T.STATUS == 1 THEN 'ON' 
              WHEN T.STATUS == 2 THEN '단선' 
              WHEN T.STATUS == 3 THEN '과전류' 
              WHEN T.STATUS == 4 THEN '온도센서' 
              WHEN T.STATUS == 5 THEN '위치인식' 
              WHEN T.STATUS == 6 THEN '통신오류'
              END STATUS_TEXT
      FROM (
      SELECT 
        SEQ,
        DEVICE_ID,
        STATUS,
        LEAD (STATUS,1,0) OVER (PARTITION BY DEVICE_ID ORDER BY createdAt DESC) AS PRE_STATUS,
        DESC,
        createdAt,
        updatedAt,
        strftime('%Y-%m-%d %H:%M:%S',createdAt) AS DT,
        LEAD (strftime('%Y-%m-%d %H:%M:%S',createdAt),1,0) OVER (PARTITION BY DEVICE_ID ORDER BY createdAt DESC) AS PRE_DT
      FROM
        TB_HISTORY ) T
      WHERE T.STATUS NOT IN (0, 1)  
      AND T.STATUS != T.PRE_STATUS
      ORDER BY T.DT DESC
      
    `, {  
      //replacements: { from: from, to: to }, 
      type: Sequelize.QueryTypes.SELECT 
    }); 

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while getAlertList' });
  }
});

router.post('/getNewAlertList', async(req, res) =>{
  try {
    const lastDate = req.body.lastDate;
    console.log("getNewAlertList >>>>>>>>>>>>>>>>>>>>>>>> " + lastDate );
    // history 조회 쿼리를 from to 로 createAt 컬럼을 strfime('%Y-%m-%d') 사용하여 기간만큼 데이터 조회
    const results = await sequelize.query(`
    SELECT T.SEQ,
      T.DEVICE_ID,
      T.DT,
      T.PRE_DT,
      T.createdAt,
      T.updatedAt,
      T.DESC,
        CASE 
        WHEN T.STATUS != T.PRE_STATUS AND length(T.DESC) == 0 THEN true
        WHEN T.STATUS != T.PRE_STATUS AND length(T.DESC) > 0 THEN false
        WHEN T.STATUS == T.PRE_STATUS AND length(T.DESC) > 0 THEN false
        WHEN T.STATUS == T.PRE_STATUS AND length(T.DESC) == 0 THEN false
        END BLINK,
        T.STATUS,
        CASE WHEN T.STATUS == 0 THEN 'OFF' 
              WHEN T.STATUS == 1 THEN 'ON' 
              WHEN T.STATUS == 2 THEN '단선' 
              WHEN T.STATUS == 3 THEN '과전류' 
              WHEN T.STATUS == 4 THEN '온도센서' 
              WHEN T.STATUS == 5 THEN '위치인식'
              WHEN T.STATUS == 6 THEN '통신오류'
              END STATUS_TEXT
      FROM (
      SELECT 
        SEQ,
        DEVICE_ID,
        STATUS,
        LEAD (STATUS,1,0) OVER (PARTITION BY DEVICE_ID ORDER BY createdAt DESC) AS PRE_STATUS,
        DESC,
        createdAt,
        updatedAt,
        strftime('%Y-%m-%d %H:%M:%S',createdAt) AS DT,
        LEAD (strftime('%Y-%m-%d %H:%M:%S',createdAt),1,0) OVER (PARTITION BY DEVICE_ID ORDER BY createdAt DESC) AS PRE_DT
      FROM
        TB_HISTORY ) T
      WHERE T.STATUS NOT IN (0, 1)  
      AND T.STATUS != T.PRE_STATUS
      AND strftime('%Y-%m-%d %H:%M:%S', T.createdAt, 'localtime') > :lastDate
      ORDER BY T.DT DESC
      
    `, {  
      replacements: { lastDate: lastDate}, 
      type: Sequelize.QueryTypes.SELECT 
    }); 

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while getAlertList' });
  }
});

// History insert
router.post('/saveHistory', async (req, res) => {
  console.log("---- req.body : ",req.body);

  try {
    // const { deviceId, terminalId, onTemp, currTemp, msg } = req.body;

    // let rt = 10000 * ((4096 / req.body.CURR_TEMP));
    // let T = 1/( (1/298.15) + (1/3950) * Math.log(rt/10000));
    // let C = T - 237.15;
    
    const newHistory = await History.create(req.body);
    
    // const seq = newHistory.SEQ;
    // const etc = req.body.ETC;
    
    // let results = await sequelize.query(`
    //   SELECT DEVICE_ID AS DEVICE_ID,
    //   CURR_TEMP AS CURR_TEMP,
    //     ON_TEMP AS ON_TEMP,
    //     OFF_TEMP AS OFF_TEMP
    //   FROM TB_HISTORY 
    //     WHERE SEQ = :SEQ;
    // `, {
    //   replacements: { SEQ : seq, ETC: etc},
    //   type: Sequelize.QueryTypes.SELECT
    // });
    //히스토리 저장 후 히터에도 UPSERT
    let findRow = await Heater.findOne({ 
      where: { 'DEVICE_ID': req.body.DEVICE_ID },
    });
    const today = moment();
    if(!findRow){
      const newHeater = await Heater.create({
        DEVICE_ID: req.body.DEVICE_ID,
        FLOOR_ID: "",
        SECTION_ID: "",
        STATUS : req.body.STATUS,
        CURR_TEMP : req.body.CURR_TEMP,
        CURRENT:  req.body.CURRENT,
        DESC : "",
        createdAt: today,
        updatedAt: today
      });
    }else{
        const status = await sequelize.query(`
        SELECT CASE WHEN COMMAND == 2 AND STATUS == 5 THEN false ELSE true END STATUS FROM TB_HEATER WHERE DEVICE_ID = :device_id
        `, {
          replacements: { device_id: req.body.DEVICE_ID},
          type: Sequelize.QueryTypes.SELECT
        })
        if(!status[0].STATUS){
          const resultHeater = await sequelize.query(`
            UPDATE TB_HEATER
              SET CURR_TEMP = :curr_temp,
                  CURRENT = :current,
                  updatedAt = CURRENT_TIMESTAMP
                WHERE DEVICE_ID = :device_id
                `, {
            replacements: { curr_temp : req.body.CURR_TEMP, current: req.body.CURRENT, device_id: req.body.DEVICE_ID},
            type: Sequelize.QueryTypes.UPDATE
          });
          const stt = setTimeout(() => {
            const resultHeater = sequelize.query(`
              UPDATE TB_HEATER
                SET STATUS = :status
                  WHERE DEVICE_ID = :device_id
                  `, {
              replacements: { status: req.body.STATUS, device_id: req.body.DEVICE_ID},
              type: Sequelize.QueryTypes.UPDATE
            })
          }, 30000);
          //clearTimeout(stt);
        }else{
          const resultHeater = await sequelize.query(`
            UPDATE TB_HEATER
              SET CURR_TEMP = :curr_temp,
                  CURRENT = :current,
                  STATUS = :status,
                  updatedAt = CURRENT_TIMESTAMP
                WHERE DEVICE_ID = :device_id`, {
            replacements: { curr_temp : req.body.CURR_TEMP, current: req.body.CURRENT, status: req.body.STATUS, device_id: req.body.DEVICE_ID},
            type: Sequelize.QueryTypes.UPDATE
          });
        }
        
  }
  let results = await sequelize.query(`
      SELECT DEVICE_ID AS DEVICE_ID,
      CURR_TEMP AS CURR_TEMP,
        ON_TEMP AS ON_TEMP,
        OFF_TEMP AS OFF_TEMP,
        COMMAND AS COMMAND
        -- strftime('%s', 'now') - strftime('%s', updatedAt) AS DIFF_SEC
      FROM TB_HEATER
        WHERE DEVICE_ID = :device_id`, {
      replacements: { device_id: req.body.DEVICE_ID},
      type: Sequelize.QueryTypes.SELECT
    });
  //   if(results[0].DIFF_SEC > 60){
  //     const resultHeater = await sequelize.query(`
  //       UPDATE TB_HEATER
  //         SET COMMAND = '0'
  //           WHERE DEVICE_ID = :device_id`, {
  //       replacements: { device_id: req.body.DEVICE_ID},
  //       type: Sequelize.QueryTypes.UPDATE
  //     });
  //     results[0].COMMAND = '0';
  //   }
  //  delete results[0].DIFF_SEC;
    res.json(results); // 업로드된 파일들의 메타데이터를 응답으로 전송합니다.
  } catch (error) { 
    console.error(error);
    res.status(500).json({ error: 'An error occurred while saveHistory' });
  }
});

router.post('/updateAlertDesc', async (req, res) => {
  
  try {
    const params = req.body;
    let result = '';
    params.forEach(async item => {
       result = await sequelize.query(`
        UPDATE TB_HISTORY
          SET DESC = :desc,
          updatedAt = CURRENT_TIMESTAMP
          WHERE SEQ = :seq
        `,
        {
          replacements: { seq: item.SEQ, desc: item.DESC }, // 바인딩
          type: Sequelize.QueryTypes.UPDATE,
         })
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while updateAlertDesc' });
  }
});


  
  module.exports = router;