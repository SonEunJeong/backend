const express = require('express');
const app = express();
const cors = require('cors');

const path = require('path')

const userRoutes = require('./routes/users');
const systemRoutes = require('./routes/system');
const heaterRoutes = require('./routes/heater');
const filesRoutes = require('./routes/files');
const historyRoutes = require('./routes/history');
//const buildingRoutes = require('./routes/buildings');

app.use(express.json())
app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('./public'));

// 미들웨어 정의
app.use((req, res, next) => {
    req.globalData = {
      // 여기에 원하는 데이터를 추가하세요
    };
    next();
  });

app.use('/api/user', userRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/heater', heaterRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/hist', historyRoutes);
//app.use('/api/building', buildingRoutes);

const schedule = require('node-schedule');
const { Op, Sequelize, where } = require("sequelize");
const { sequelize, Heater, History } = require('./model/db');

// schedule.scheduleJob(rule, async () => {
//   console.log('--- scheduleJob ---');
//   const today = new Date();

//   // 삭제전 from:현재일자-4달 to:현재일자 를 'yyyymmdd'의 date 형식 파라메터로  History.exportExcel() 호출
//   const from = moment(today).subtract(4, 'months').format('YYYYMMDD');
//   const to = moment(today).format('YYYYMMDD');
   
//   console.log('--- from : ',from);
//   console.log('--- to : ',to);

//   // from 보다 작은 날짜의 데이터를 엑셀로 export
//   await History.exportExcel(from, to);  


//   const result = await History.destroy({
//     where: {
//       // createdAt이 from 보다 적은 날짜
//       createdAt: {
//         [Op.lt]: from
//       }
//     }          
//   });
//   console.log('--- scheduleJob result : ',result);
// });

schedule.scheduleJob('0 1 * * * *', async () => {
  console.log('--- scheduleJob heater status update ---');
  try {

    const deviceId = await sequelize.query(`
    SELECT DEVICE_ID
      FROM TB_HEATER
    WHERE strftime('%Y-%m-%d %H:%M', CURRENT_TIMESTAMP) >= strftime('%Y-%m-%d %H:%M', updatedAt, '1 minutes') 
    `, {  
      type: Sequelize.QueryTypes.SELECT
    }); 
    
    deviceId.forEach(async (item)=> {
      const result = await History.create({ DEVICE_ID: item.DEVICE_ID, STATUS: 6 });
      const result1 = await Heater.update({STATUS: 6, updatedAt: sequelize.fn('NOW')}, { where: {DEVICE_ID: item.DEVICE_ID} });
    });
    //console.log("수정된 히터 디바이스 :::: >>>>>>>>>>>>>>>>> " + results);
    console.log('--- scheduleJob heater status update complete---');
  } catch (error) {
    console.error(error);
  }
});


// 현지시간으로 매일 03시 00분에 현재일자기준 최근 3개월치 를 제외 한 모든 TB_HISTORY 데이터 삭제

// const rule = new schedule.RecurrenceRule();
// rule.hour = 3;
// rule.minute = 0;
// rule.second = 0;
// schedule.scheduleJob(rule, async () => {
//   console.log('--- scheduleJob ---');
//   const today = new Date();
//   const threeMonthAgo = new Date(today.setMonth(today.getMonth() - 3));
//   console.log('--- threeMonthAgo : ',threeMonthAgo);
//   const result = await History.destroy({
//     where: {
//       createdAt: {
//         [Op.lt]: threeMonthAgo
//       }
//     }
//   });
//   console.log('--- scheduleJob result ');
// });


const server = app.listen(8001,()=>{
    //console.log(`Server is listening on port 3000 `, server.address().address);    
    
    // setTimeout(() => {
    //     const { twelite } = require('./plugin/serialComm')
    // }, 2000); 

});

var router = express.Router();

router.get('/', function(req, res, next){
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
})