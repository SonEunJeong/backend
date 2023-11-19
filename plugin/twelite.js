var {SerialPort} = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline')
var stream = require('stream');
var util = require('util');

var defaultSettings = {
    type: 'easyapp',
    autoOpen: true,
    baudRate: 115200,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    xon: false,
    xoff: false,
    xany: false,
    rtscts: false,
    parser: new ReadlineParser()
};

var rcvStr ="";

// 온도 값 계산
function hexToTemp(hex) {
    const hexInDecimal = parseInt(hex, 16);
    const startHex = parseInt('FF', 16);  // FF는 71도를 나타내므로
    const temp = startHex - hexInDecimal + 71;  // 입력 값이 'FF'인 경우 71을 반환하도록 보정
    return temp;
}

function hexToAmpere(hex) {
    const map = {
        "FF" : 5.1,
        "4F" : 5.0,
        "4E" : 4.9,
        "4D" : 4.8,
        "4C" : 4.7,
        "4B" : 4.6,
        "4A" : 4.5,
        "49" : 4.4,
        "48" : 4.3,
        "47" : 4.2,
        "46" : 4.1,
        "45" : 4.0,
        "44" : 3.9,
        "43" : 3.8,
        "42" : 3.7,
        "41" : 3.6,
        "40" : 3.5,
        "3F" : 3.4,
        "3E" : 3.3,
        "3D" : 3.2,
        "3C" : 3.1,
        "3B" : 3.0,
        "3A" : 2.9,
        "39" : 2.8,
        "38" : 2.7,
        "37" : 2.6,
        "36" : 2.5,
        "35" : 2.4,
        "34" : 2.3,
        "33" : 2.2,
        "32" : 2.1,
        "31" : 2.0,
        "30" : 1.9,
        "2F" : 1.8,
        "2E" : 1.7,
        "2D" : 1.6,
        "2C" : 1.5,
        "2B" : 1.4,
        "2A" : 1.3,
        "29" : 1.2,
        "28" : 1.1,
        "27" : 1.0,
        "26" : 0.9,
        "25" : 0.8,
        "24" : 0.7,
        "23" : 0.6,
        "22" : 0.5,
        "21" : 0.4,
        "20" : 0.3,
        "1F" : 0.2,
        "1E" : 0.1,
        "00" : 0.0
    };

    return map[hex.toUpperCase()]   || 5.1 ; 
}

function TweLite(portname, options, callback) {

    if(typeof options === 'function') {
        callback = options;
        options = {};
    }

    options = options || {};

    if(!portname) {
        throw new TypeError('No port name specified');
    }

    this.portname = portname;

    var settings = Object.assign({}, defaultSettings, options);

    //console.log(settings);  // debug

    stream.Stream.call(this);

    this.isOpen = false;

    this.open(portname, settings, function(err) {
        if(err) {
            return this._error(err, callback);
        }
        console.info('twe-lite connected');   // debug
    });
}

util.inherits(TweLite, stream.Stream);  // TweLite extends stream.Stream

TweLite.prototype.serialport = undefined;

TweLite.prototype._error = function(error, callback) {
    if(callback) {
        callback.call(this, error);
    } else {
        this.emit('error', error);
    }
};

TweLite.prototype.open = function(portname, settings, callback) {
    if(this.isOpen) {
        return this._error(new Error('Port is already open'), callback);
    }
    if (this.opening) {
        return this._error(new Error('Port is opening'), callback);
    }
    this.opening = true;
    var tweliteType = settings.type;
    delete settings.type;
    
    settings.path = portname;

    var serialSettings = settings;
    //console.info(serialSettings);
    this.serialport = new SerialPort(serialSettings);
    this.serialport.on('open', function() {
        this.isOpen = true;
        this.opening = false;
        this.listenData(tweliteType);
        if(callback) { callback.call(this, null); }
    }.bind(this));
    this.serialport.on('error', function(err) {
        console.error('SerialPort has an error !');     // debug
        return this._error(err, callback);
    }.bind(this));
    this.serialport.on('disconnect', function() {
        this.opening = false;
        this.isOpen = false;
        console.error('SerialPort disconnected');     // debug
    }.bind(this));
};

TweLite.prototype.listenData = function(type) {
    this.serialport.on('data', function(raw) {
        const buffer = Buffer.from(raw, 'hex');
        const newlineIndex = buffer.indexOf('\n');  // or '\r\n' for CR+LF
        
        console.log(String.fromCharCode(...buffer))
        rcvStr += String.fromCharCode(...buffer)
        if (newlineIndex !== -1) {

            // rcvStr 내용을 \r\n is기준으로 나누어서 rcvStr에 저장
            rcvStr = rcvStr.split('\r\n')[0]

            // rcvStr에 \r\n 다시 추가
            rcvStr += '\r\n'

            // console.log("data complete =>",rcvStr)
            let obj = this.dispatchDataByType(type, rcvStr);
            this.emit('data', obj);

            // buffer내용중 newlineIndex 보다 큰 buffer부분을 String.fromCharCode로 컨버팅하여 다시 rcvStr에 저장
            rcvStr = String.fromCharCode(...buffer.slice(newlineIndex+1, buffer.length))
            

        }else{
            // console.log(rcvStr) ;
        }

    }.bind(this));
};

TweLite.prototype.dispatchDataByType = function(type, raw) {
    var obj = {};
    switch(type) {
        case 'easyapp':
            obj = this.parseEasyAppData(raw);
            break;
    }
    return obj;
};

TweLite.prototype.parseEasyAppData = function(buffer) {
    var data = {};
    data.raw = buffer;
    // Ref: http://qiita.com/Omegamega/items/b15bae4654f197ff9da8#%E7%9B%B8%E6%89%8B%E7%AB%AF%E6%9C%AB%E3%81%AE%E7%8A%B6%E6%85%8B%E9%80%9A%E7%9F%A5%E3%81%8B%E3%82%89%E9%9B%BB%E6%B3%A2%E5%BC%B7%E5%BA%A6%E3%81%A8%E9%9B%BB%E6%BA%90%E9%9B%BB%E5%9C%A7%E3%81%8C%E4%B9%97%E3%81%A3%E3%81%A6%E3%81%84%E3%82%8B
    data.deviceId = parseInt(buffer.slice(1,3).toString(), 16);
    data.datatype = buffer.slice(3,5).toString();
    data.packetId = buffer.slice(5,7).toString();
    data.protocol = buffer.slice(7,9).toString();
    data.signal = parseInt(buffer.slice(9,11).toString(), 16);
    data.terminalId = parseInt(buffer.slice(11,19).toString(), 16);
    data.toId = parseInt(buffer.slice(19,21).toString(), 16);
    data.timestamp = parseInt(buffer.slice(21,25).toString(), 16);
    data.repeater_flag = parseInt(buffer.slice(25,27).toString(), 16);
    data.battery = parseInt(buffer.slice(27,31).toString(), 16);
    var rawDigitalIn = parseInt(buffer.slice(33,35).toString(), 16);
    data.digialIn = [
        (rawDigitalIn >> 0 & 1) ? true : false,
        (rawDigitalIn >> 1 & 1) ? true : false,
        (rawDigitalIn >> 2 & 1) ? true : false,
        (rawDigitalIn >> 3 & 1) ? true : false,
    ];
    var rawDigitalChanged = parseInt(buffer.slice(35,37).toString(), 16);
    data.digialChanged = [
        (rawDigitalChanged >> 0 & 1) ? true : false,
        (rawDigitalChanged >> 1 & 1) ? true : false,
        (rawDigitalChanged >> 2 & 1) ? true : false,
        (rawDigitalChanged >> 3 & 1) ? true : false,
    ]
    data.analogIn = [
        parseInt(buffer.slice(37,39).toString(), 16),
        parseInt(buffer.slice(39,41).toString(), 16),
        parseInt(buffer.slice(41,43).toString(), 16),
        parseInt(buffer.slice(43,45).toString(), 16),
    ]
    data.analogOffset = parseInt(buffer.slice(45,47).toString(), 16);
    data.checksum = parseInt(buffer.slice(47,49).toString(), 16);

      
      const rawData = data.raw;

        // 체크섬을 계산하는 함수
        const checksumCalc = (bf) => {
        let sum = 0;
        for (let byte of bf) {
            sum += byte;
        }
        const remainder = sum % 0x100;
        const checksum = (0x100 - remainder) % 0x100;
        return checksum;
        };

        // 헤더를 제거하고 체크섬을 검증합니다.
        const dataWithoutHeader = rawData.substring(1, rawData.length-4); // 헤더와 체크섬을 제외합니다.
        const receivedChecksum = parseInt(rawData.slice(-4, -2), 16); // 체크섬 부분을 분리합니다.

        // console.log('- dataWithoutHeader is ',dataWithoutHeader);
        // console.log('- receivedChecksum is ',receivedChecksum);

        const b = Buffer.from(dataWithoutHeader, 'hex');
        const calculatedChecksum = checksumCalc(b);

        // console.log(`Received checksum: ${receivedChecksum.toString(16).toUpperCase()}`);
        //console.log(`Calculated checksum: ${calculatedChecksum.toString(16).toUpperCase()}`);

        if (receivedChecksum === calculatedChecksum) {
            // console.log('Checksum is valid.',calculatedChecksum.toString(16).toUpperCase());
            data.checksumVaild = true;
        } else {
            // console.log('Checksum is invalid.',calculatedChecksum.toString(16).toUpperCase());
            data.checksumVaild = false;
        }
       
        // 현재온도
        data.currTemp = hexToTemp(buffer.slice(37,39).toString())
        // 전류 hexToAmpere 사용
        data.power = hexToAmpere(buffer.slice(39,41).toString())

        // 오류내용
        // data.msg = "[히터-011]";

        // 디바이스Id 임시로 terminalId로 대체
        // data.deviceId = data.terminalId;

    return data;
}

TweLite.prototype.write = function(buffer, callback) {
    var data = buffer;
    this.serialport.write(data, function(err,result) {
        callback(err,result);
    });
};

module.exports = TweLite;