const express = require('express');
const router = express.Router();

const { sequelize,  Files } = require('../model/db');
const fs = require('fs');
const path = require('path');
const multer  = require('multer')

const uploadFolder = './uploads/';
// 폴더가 존재하는지 확인
if (!fs.existsSync(uploadFolder)) {
  // 폴더가 없으면 생성
  fs.mkdirSync(uploadFolder);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder)
  },
  filename: function (req, file, cb) {
    const fileName = path.basename(file.originalname, path.extname(file.originalname)); // 확장자를 제외한 파일 이름
    const fileExtension = path.extname(file.originalname); // 파일 확장자

    cb(null, `${Date.now()}-${(fileName)}${fileExtension}`);
  }
});
const upload = multer({ storage: storage });


router.get('/getFileList/:div', async function (req, res) {
  console.log("files .js >>>>>>" + req.baseUrl);
  console.log("---- req.params : ",req.params);

  try {
      const files = await sequelize.query(`
          SELECT max(groupId) AS groupId, title, creater, MAX(downloadCnt) as downloadCnt, 
          GROUP_CONCAT(JSON_OBJECT('id',id,'seq', seq, 'filePath', filePath,'fileName',fileName,'fileExt', fileExt,'fileSize', fileSize)) as attchFiles
          ,MAX(updatedAt) as updatedAt
          FROM TB_FILES
          WHERE div = :div
          GROUP BY groupId,title, creater
      `, {
        replacements: { div: req.params.div },
        type: sequelize.QueryTypes.SELECT 
      });
      // 각 파일의 attchFiles를 JSON 배열로 변환합니다.
      files.forEach(file => {
          file.attchFiles = JSON.parse(`[${file.attchFiles}]`);
      });

      res.json(files);
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while fetching files' });
  }
});
  
router.post('/saveFile', upload.array('files'), async (req, res) => {
  console.log("---- req.body : ",req.body);

  try {
    const { groupId , div, title, creater } = req.body;
    const files = req.files; // 이제 req.files는 업로드된 파일들의 배열입니다.

    const newFiles = [];
    let currGroupId = (!groupId || groupId ==='undefined' ) ? (await Files.max('groupId') || 0 )+1 :  groupId;
    
    let seq = await Files.max('seq',{ where: { groupId: currGroupId } }) || 0
    for (let file of files) {
      // 파일의 이름과 확장자 분리
      const fileName = path.basename(file.originalname);
      const fileExt = path.extname(file.originalname);
      const fileSize = (file.size / 1024 / 1024).toFixed(2); // bytes to MB

      const rowData = {
        groupId : currGroupId,
        div,
        title,
        creater,
        seq : ++seq,  
        filePath: file.path,
        fileName,
        fileExt,
        fileSize : (fileSize || 0 ) + 'MB',
      };
      console.log("---- Files.upsert --- rowData : ",rowData);

      const newFile = Files.upsert(rowData);

      newFiles.push(newFile);
    }
    
    await Files.update({ title, creater }, { where: { groupId: currGroupId } });

    res.json(newFiles); // 업로드된 파일들의 메타데이터를 응답으로 전송합니다.
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while uploading files' });
  }
});
  
  router.delete('/deleteFile/:groupId/:seq', async function (req, res) {
    console.log("---- req.params : ",req.params);
    try {      
      await Files.destroy({
        where: req.params.seq != 'undefined' ? { groupId: req.params.groupId, seq: req.params.seq } : { groupId: req.params.groupId } 
      });
      res.json({result: `${req.params} 's Files deleted`});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while deleting Files' });
    }
  });

  router.get('/downloadFile/:id/:seq', async (req, res) => {
    try {
      const { id ,seq } = req.params;
      
      // 데이터베이스에서 파일 메타데이터를 찾음
      const file = await Files.findOne({ where: { id: id, seq: seq } });
  
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
  
      // 파일의 경로
      const filePath = file.filePath;
  
      // 파일 다운로드
      res.download(filePath, (err) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: 'An error occurred while downloading file' });
        } else {
          // 파일 다운로드 후 downloadCnt 증가
          file.increment('downloadCnt');

        }
      });
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while fetching file' });
    }
  });
  

  
  module.exports = router;