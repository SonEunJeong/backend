const { Op,Sequelize, DataTypes } = require('sequelize');
const sqlite = require('sqlite3');
const bcrypt = require('bcrypt');
const os = require('os');

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

try {

    function getLocalExternalIP(){
        const networkInterfaces = os.networkInterfaces();
    
        let localIPs = [];
    
        for (let interfaceName in networkInterfaces) {
        let addresses = networkInterfaces[interfaceName];
    
        for (let addressInfo of addresses) {
            if (addressInfo.family === 'IPv4' && !addressInfo.internal) {
            const subnet = addressInfo.address.split('.')[0];
    
            // 일반적으로 외부 네트워크에 연결된 IP 범위
            if (subnet === '192' || subnet === '10' || (subnet === '172' && (16 <= parseInt(addressInfo.address.split('.')[1]) <= 31))) {
                localIPs.push(addressInfo.address);
                console.log(`Server ip : ${ JSON.stringify(addressInfo)}`); // addressInfo.address
            }
            }
        }
        }
    
        return localIPs[0];
    }

    const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite', 
    logging: process.env.NODE_ENV === 'DEV' ? true : false,  // 로깅 끄기
    // timezone: "Asia/Seoul",
    // dialectOptions: {
    //     charset: "utf8mb4",
    //     dateStrings: true,
    //     typeCast: true,
    //   },
    });

    const User = sequelize.define('TB_USER', {
        usrId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        usrNm: {
            type: DataTypes.STRING,
            allowNull: false
        },
        pwd: {
            type: DataTypes.STRING,
            allowNull: false
        },
        lastLoginDtm: {
            type: DataTypes.DATE,
            allowNull: true
        },
        role: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'USER'
        },
        isLock: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'N'
        },
        },
        {
        freezeTableName: true,
        timestamps: true, // createdAt, updatedAt 컬럼 사용
        hooks: {
            beforeCreate: (user) => {
              const salt = bcrypt.genSaltSync();
              user.pwd = bcrypt.hashSync(user.pwd, salt);
            },
            afterCreate: (user) => {
              console.log(`New user successfully created: ${user.usrNm}`);
            }
          }
        });
    
    const Building = sequelize.define('TB_BUILD', {
         /* Define your model properties here */ 
         FLOOR_ID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
            defaultValue : '99',
         },
         SECTION_ID: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
            defaultValue : '99',
         },
         FLOOR_NM:{
            type: DataTypes.STRING,
            allowNull: false,
         },
         SECTION_NM:{
            type: DataTypes.STRING,
            allowNull: false,
         }
    },{freezeTableName: true,timestamps: true,
    });

    const Heater = sequelize.define('TB_HEATER', {
         /* Define your model properties here */ 
         DEVICE_ID:{
            type: DataTypes.STRING,
            primaryKey: true,
            unique: true,
            allowNull: false,   
            defaultValue : 1,         
         },
         FLOOR_ID: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '',
         },
         SECTION_ID: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '',
         },
         STATUS:{
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue:''
        },
        //  CONNCECT:{
        //      type: DataTypes.STRING,
        //      allowNull: true,
        //      defaultValue:'N'
        //  },
        CURRENT:{
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue:''
        },
        CURR_TEMP:{
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue:''
        },
        ON_TEMP:{
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue:''
        },
        OFF_TEMP:{
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue:''
        },
        COMMAND:{
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue:'0'
        }
    },{freezeTableName: true,timestamps: true,
    });
    // Heater.sync().then((model)=>{
    //     // 초기 행 삽입
    //     const initRows = [
    //         {
    //             DEVICE_ID: "0001",
    //             FLOOR_ID: "B1",
    //             SECTION_ID: "S1"
    //         },
    //         {
    //             DEVICE_ID: "0002",
    //             FLOOR_ID: "B1",
    //             SECTION_ID: "S2",
    //         }
    //     ];

    //     let upserted;
    //     for (const record of initRows) {
    //         upserted = model.upsert(record);
    //     }

    //     if (upserted) {
    //         console.log('Initial row created or updated in TB_HEATER.');
    //     } else {
    //         console.log('An error occurred while upserting the initial row in TB_HEATER.');
    //     }
    // }).catch((err)=>{
    //     console.error(`TB_BUILD sync Error : ${err.message}`)
    // });
    // const System = sequelize.define('TB_SYSTEM', {
    //     systemNm: {
    //         type: DataTypes.STRING,
    //         allowNull: false,
    //     },
    //     systemVer: {
    //         type: DataTypes.STRING,
    //         allowNull: false,
    //         defaultValue: '1.0'
    //     },
    //     wsUrl: {
    //         type: DataTypes.STRING,
    //         allowNull: true
    //     },
    //     wsPort: {
    //         type: DataTypes.STRING,
    //         allowNull: true
    //     },        
    //     apiUrl: {
    //         type: DataTypes.STRING,
    //         allowNull: false,
    //         defaultValue: '127.0.0.1'
    //     },
    //     apiPort: {
    //         type: DataTypes.STRING,
    //         allowNull: false,
    //         defaultValue: '4000'
    //     },
    //     settings: {
    //         type: DataTypes.JSON,
    //         allowNull: true
    //       },
    //     },
    //     {
    //     freezeTableName: true, timestamps: true,
    //     });

    const History = sequelize.define('TB_HISTORY', {
        SEQ:{
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        DEVICE_ID: {
            type: DataTypes.STRING,
            allowNull: false
        },
        CURR_TEMP:{
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue:''
        },
        ON_TEMP:{
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue:''
        },
        OFF_TEMP:{
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue:''
        },
        CURRENT:{
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue:''
        },
        STATUS:{
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue:''
        },
        DESC:{
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue:''
        }
        // terminalId: {
        //     type: DataTypes.INTEGER,
        //     allowNull: false,
        // },
        // CONNECT:{
        //     type: DataTypes.STRING,
        //     allowNull: true,
        //     defaultValue:'N'
        // },

        },
        {
        freezeTableName: true,   
        timestamps: true, // createdAt, updatedAt 컬럼 사용
        indexes: [
            {
                fields: ['DEVICE_ID']
            }
        ]
        });
        /*
        // 엑셀 파일로 내보내기 기능
        History.exportExcel = async function (startDate, endDate) {
            const histories = await History.findAll({
            where: {
                // createdAt이 from 보다 적은 날짜
                createdAt: {
                    [Op.lt]: endDate
                }
            }
            });
        
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('히터센서_수신이력');
        
            // 엑셀 파일의 헤더를 TB_HISTORY 컬럼으로 설정합니다.
            worksheet.columns = [
            { header: '히터ID', key: 'deviceId', width: 20 , style: { numFmt: "@" }},
            { header: '수신HEX', key: 'raw', width: 50 },
            { header: '가공Data', key: 'data', width: 150 },
            { header: '수신일시', key: 'createdAt', width: 20 , style: { numFmt: "yyyy-mm-dd hh:mm:ss" }},
            ];
        
            // TB_HISTORY 데이터를 엑셀 파일에 추가합니다.
            histories.forEach((history) => {
                worksheet.addRow({
                    deviceId: history.deviceId.toString(),
                    raw: history.raw,
                    data: JSON.stringify(history.data),
                    createdAt: history.createdAt,
                });
            
                const fileName = `수신이력백업_${moment().format('YYYYMMDD_HHmmss')}.xlsx`;
                // filePath 는 현재위치에서 상위 폴더의 excel_backup 폴더에 저장합니다.
                const filePath = path.join(__dirname, `../excel_backup/${fileName}`);

                //excel_backup 폴더가 없으면 생성
                if (!fs.existsSync(path.join(__dirname, '../excel_backup'))) {
                    fs.mkdirSync(path.join(__dirname, '../excel_backup'));
                }
                
                // 엑셀 파일을 저장합니다.
                workbook.xlsx.writeFile(filePath);
            
                return filePath;
            });
        };
*/
    // TB_FILES 테이블 동기화
    const Files = sequelize.define('TB_FILES', {
        div:{
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue : 'PRINT',
        },
        groupId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue : 1,
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        contents : {
            // 데이터 타입은 LONGTEXT로 설정합니다.
            type: DataTypes.TEXT('long'),
            allowNull: true,
        },
        creater: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        downloadCnt: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0, // 기본 다운로드 횟수는 0
        },
        seq: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1, 
        },
        filePath: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        fileName : {
          type: DataTypes.STRING,
          allowNull: false,
        },
        fileExt: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        fileSize: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 0, 
        },
      }, {
        freezeTableName: true,
        timestamps: true, // createdAt, updatedAt 컬럼 사용
      });

    User.sync().then((model)=>{
        // 초기 행 삽입
        
        const initRow = {
            id: 1,
            usrId : "smile",
            usrNm : "스마일내진",
            pwd:"1",
            role:"ADMIN",            
        };

        const salt = bcrypt.genSaltSync();
        initRow.pwd = bcrypt.hashSync(initRow.pwd, salt);

        // 'findOrCreate' 메소드를 사용하여 초기 행이 이미 있는지 확인하고,
        // 없다면 삽입합니다.
        const upserted = model.upsert(initRow);

        if (upserted) {
            console.log('Initial row created or updated in TB_USER.');
        } else {
            console.log('An error occurred while upserting the initial row in TB_USER.');
        }
    }).catch((err)=>{
        console.error(`TB_USER sync Error : ${err.message}`)
    });
    
    // 테이블 동기화
    // System.sync().then((model)=>{
    //     // 초기 행 삽입
    //     const ipAddr = getLocalExternalIP();
    //     console.log('✅ This server ip is - ',ipAddr);

    //     const systemInitRow = {
    //         id: 1,
    //         systemNm : "수계배관 스마트 열선 관리 모니터링 시스템",
    //         wsUrl : ipAddr,
    //         wsPort : "3001",
    //         apiUrl : ipAddr,
    //         apiPort : "3000",
    //     };

    //     // 'findOrCreate' 메소드를 사용하여 초기 행이 이미 있는지 확인하고,
    //     // 없다면 삽입합니다.
    //     const upserted = model.upsert(systemInitRow);

    //     if (upserted) {
    //         console.log('Initial row created or updated in TB_SYSTEM.');
    //     } else {
    //         console.log('An error occurred while upserting the initial row in TB_SYSTEM.');
    //     }
    // }).catch((err)=>{
    //     console.error(`TB_SYSTEM sync Error : ${err.message}`)
    // });

    // TB_BUILD 테이블 동기화
 
    // Building.sync().then((model)=>{
    //     // 초기 행 삽입
    //     const initRows = [
    //         {
    //             FLOOR_ID : "B1",
    //             SECTION_ID : "S1",
    //             FLOOR_NM : "지하1층",
    //             SECTION_NM : "섹션1",
    //         },
    //         {
    //             FLOOR_ID : "B1",
    //             SECTION_ID : "S2",
    //             FLOOR_NM : "지하1층",
    //             SECTION_NM : "섹션2",
    //         },
    //         {
    //             FLOOR_ID : "F1",
    //             SECTION_ID : "S1",
    //             FLOOR_NM : "지상1층",
    //             SECTION_NM : "섹션1",
    //         },
    //         {
    //             FLOOR_ID : "F1",
    //             SECTION_ID : "S2",
    //             FLOOR_NM : "지상1층",
    //             SECTION_NM : "섹션2",
    //         },
    //     ];

    //     let upserted;
    //     for (const record of initRows) {
    //         upserted = model.upsert(record);
    //     }

    //     if (upserted) {
    //         console.log('Initial row created or updated in TB_BUILD.');
    //     } else {
    //         console.log('An error occurred while upserting the initial row in TB_BUILD.');
    //     }
    // }).catch((err)=>{
    //     console.error(`TB_BUILD sync Error : ${err.message}`)
    // });

  
    User.sync();
   // System.sync();
    Heater.sync();
    History.sync();
    Building.sync();
    Files.sync();
    module.exports = { sequelize, User, Heater, History, Files, Building};

} catch (error) {
    console.error('db.js init ERROR :', error);
}