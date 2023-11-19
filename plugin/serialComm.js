
const { SerialPort } = require('serialport')
const readline = require('readline')
const NodeTwelite  =  require ( './twelite.js' ) ;
const WebSocketServer = require('./ws')
const wss_port = 3001;
var wss =  new WebSocketServer(wss_port);
var  twelite ;

const { Heater , History} = require('../model/db');

try{
   
    // 시스템에서 사용 가능한 모든 포트의 목록을 나열하는 함수
    async function listPorts() {
      console.log('1');
        try {
        const ports = await SerialPort.list();
        ports.forEach((port, index) => console.log(`${index + 1}: ${port.path} ${port.manufacturer}`));
        return ports;
        } catch (err) {
        console.error(err);
        }
    }

    // 사용자에게 입력 받는 함수
    function askUser(question) {
      console.log('2');
        const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
        })
    
        return new Promise((resolve) => rl.question(question, ans => {
        rl.close()
        resolve(ans)
        }))
    }

    // 뮤텍스로 사용할 Promise
    let mutex = Promise.resolve();

    async function checkNewHeater(rawData) {
      console.log('3');
      // 뮤텍스 대기
      mutex = mutex.then(() => new Promise(async (resolve) => {
        let findHeater = rawData;
        try {
          // 테이블에 새로운 heaterId 가 있는지 확인
          findHeater = await Heater.findOne({ 
            where: { 'terminalId': rawData.terminalId },
          });

          // newHeater 없으면 insert
          if (!findHeater) {
            // 테이블에 최근 heaterId 에서 +1 하여 새로운 heaterId 채번
            const maxHeater = (await Heater.max('heaterId')) || '0';
            console.log(" - maxHeater : ", maxHeater);

            const newHeater = await Heater.create({
              heaterId: parseInt(maxHeater) + 1,
              terminalId: rawData.terminalId,
              floorId: "99",
              heaterNm: `신규배관-${parseInt(maxHeater) + 1}`,
              status : "N",
              connect : "N",
              power : "",
              currTemp : rawData.currTemp,
              onTemp :  3 ,
              offTemp :  7,
              msg : rawData.msg,
              /* data: { status: 'N', connect: 'Y', power: '', deviceId: rawData.deviceId, packetId: 15, terminalId: rawData.terminalId, checksumVaild: rawData.checksumVaild, currTemp: rawData.currTemp, onTemp: rawData.onTemp, offTemp: rawData.offTemp, msg: rawData.msg }, */
            });
            
            // console.log(newHeater); // 새로 생성된 deviceId 출력
            findHeater = newHeater;

          }else{
            
            // findHeater status 정의 currTemp가 onTemp 이하이면 'Y' , offTemp 이상이면 'N'
            findHeater.status = rawData.currTemp <= findHeater.onTemp ? 'Y' : rawData.currTemp >= findHeater.offTemp ? 'N' : '';
            findHeater.connect = 'Y';
            findHeater.msg = rawData.currTemp <= findHeater.onTemp ? '[히터-ON]' : rawData.currTemp >= findHeater.offTemp ? '[히터-OFF]' : '';
            
            //findHeater.msg 가 [히터-OFF] 면 TweLite.prototype.write  호출
            if( findHeater.msg === '[히터-OFF]' || findHeater.msg === '[히터-ON]' ){
              let command = Buffer.from(':78FF','hex');
              console.log( '::: 데이터송신 : '+findHeater.msg+' 전송명령 ' ,command) ;
                /* twelite.write( command , function ( err , result )  {
                  if ( err )  {
                      console.log( 'Error on write : ' , err.message ) ;
                  }  else  {
                      console.log( '-- twelite.write 완료' ,result) ;
                  }
                } 
              ) ;*/
            }

          }

        } catch (error) {
          console.error(" - checkNewHeater ERROR : ", error);

          findHeater.connect = 'N';
          findHeater.msg = "[히터-수집오류]";

        } finally {
          
          rawData.onTemp = findHeater.onTemp
          rawData.offTemp = findHeater.offTemp          
          rawData.msg = findHeater.msg
          wss.broadcastData(rawData); // 웹소켓으로 데이터 전송

          // 수신이력 저장
          let history = {
                        deviceId:rawData.deviceId 
                      , terminalId:rawData.terminalId
                      , onTemp:findHeater.onTemp
                      , currTemp:rawData.currTemp
                      , offTemp:findHeater.offTemp
                      , power:rawData.power
                      , msg:findHeater.msg
                      , raw:rawData.raw 
                      };
          History.create(
            {
              ...history , data: history
            }
          );

          // 뮤텍스 해제
          resolve();
        }
      }));
    }
  
  // 포트 목록 나열
  listPorts()
    .then(ports => {
      console.log('4');
      // 사용자에게 포트를 선택하도록 요청
      return askUser('Select a port number: ')
        .then(index => {
          // 사용자가 선택한 포트에서 데이터를 읽음
          let selectedPort = ports[index - 1];
          // readFromPort(selectedPort)
          
          let  portName  =  selectedPort.path ;
          twelite  =  new  NodeTwelite ( portName ) ;
          twelite.on( 'data' ,  function ( data )  {
              //console.log( data.deviceId , data.datatype ,data.checksum ) ;
              let {deviceId, packetId, terminalId, checksumVaild, currTemp,power,msg,raw} = data;
              let rtn = {
                deviceId,
                packetId,
                terminalId,
                checksumVaild,                
                currTemp,
                power,
                msg,
                createdAt : // 로컬 시간 24시로 표시
                  new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }),
              };
              
              checkNewHeater(rtn); // 신규 device 수집              
          }) ;

        })
    })
    .catch(err => console.error(err))

    module.exports = { twelite };


} catch (error) {
    console.error('serialComm.js init ERROR :', error);
}