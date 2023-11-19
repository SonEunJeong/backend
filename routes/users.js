const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const { sequelize,User } = require('../model/db');
const bcrypt = require('bcrypt');

router.post('/login', async function (req, res) {
  console.log("/login");
    try {
      console.log("---- req.body : ",req.body);

      const { usrId, pwd } = req.body;
      const user = await User.findOne({ where: { usrId: usrId } });
  
      if (!user) {
        res.status(401).json({ error: 'No user with the given username.' });
      } else if (!bcrypt.compareSync(pwd, user.pwd)) {
        res.status(401).json({ error: 'Password incorrect.' });
      
      // isLock 이 Y면 로그인 불가
      } else if ( user.isLock === 'Y' ){
        res.status(500).json({ msg: '[관리자문의] 사용자가 잠겨있습니다.' });
              
      } else {

        // 마지막 로그인 일시를 업데이트합니다.
        await User.update({ lastLoginDtm: new Date() }, { where: { usrId: usrId } }); 

        // Passwords match! Create a session, or issue a token, etc...
        res.json(user);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ msg:error.message });
    }
  });

router.get('/list', async function (req, res) {
  console.log("user.js base url : " +  req.baseUrl);
  console.log(" ---- req.param: " + req.params);
    try {
      const users = await User.findAll();

      // 사용자 정보 중 'pwd' 필드를 빈 문자열로 설정
      const modifiedUsers = users.map(user => {
        // Sequelize 반환 객체는 JSON으로 변환하여 수정해야 합니다
        const userJSON = user.toJSON();        
        userJSON.pwd = '';
        return userJSON;
      });

      res.json(modifiedUsers);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while fetching users' });
    }
  });
  
  router.post('/create', async function (req, res) {
    try {
      console.log("---- req.body : ",req.body);
      let params = req.body
      let rtn;

      if( params[0] ){
        params.forEach(user => {
          
          if( !user.pwd || user.pwd === '' ){
            let tmpUser = User.findOne({ where: { usrId: user.usrId } })
            .then((u)=>{
              user.pwd = u.pwd
              console.log(" 기존 사용자 비번 => ",u.pwd)
              console.log(" upsert! => ",user)
              rtn = User.upsert(user);          
            });
          }else{
            const salt = bcrypt.genSaltSync();
            user.pwd = bcrypt.hashSync(user.pwd, salt);
            rtn = User.upsert(user);
          }
        });
      }else{
        const salt = bcrypt.genSaltSync();
        params.pwd = bcrypt.hashSync(params.pwd, salt);
        rtn = await User.upsert(params);
      }

      res.json({result: rtn});
    } catch (error) {
      console.error(error);

        // 오류 유형에 따라 적절한 응답 반환
        if (error instanceof Sequelize.UniqueConstraintError) {
            // 중복 오류 발생 시
            res.status(409).json({ error: '중복된 사용자 정보입니다.' });
        } else {
            // 그 외의 오류
            res.status(500).json({ error: 'An error occurred while creating user - '+error.message });
        }
    }
  });
  
  router.put('/update/:usrId', async function (req, res) {
    try {
      const user = await User.update(req.body, {
        where: {
          usrId: req.params.usrId
        }
      });
      res.json({result: user});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while updating user' });
    }
  });
  
  router.delete('/delete/:usrId', async function (req, res) {
    try {
      await User.destroy({
        where: {
          usrId: req.params.usrId
        }
      });
      res.json({result: 'User deleted'});
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while deleting user' });
    }
  });
  
  module.exports = router;