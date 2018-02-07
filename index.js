const axios = require('axios');
const fs = require('fs');
const prompt = require('prompt');
const AipOcrClient = require('baidu-aip-sdk').ocr;

const config = require('./config');

const URL_ON_SALE = 'https://pet-chain.baidu.com/data/market/queryPetsOnSale';
const URL_CAPTCHA = 'https://pet-chain.baidu.com/data/captcha/gen';
const URL_BUY = 'https://pet-chain.baidu.com/data/txn/create';
const RARE_DEGREE = ['普通', '稀有', '卓越', '史诗', '神话'];
const IMAGE_PATH = 'assets/captcha.png';

// 设置 cookie
const axiosInstance = axios.create({
  headers: { 'Cookie': config.cookie }
});

// 初始化百度 ORC client

const client = new AipOcrClient(...config.baiduORC);

/**
 * 判断狗是否值得购买
 *
 * @param {object} pet - 狗的信息
 * @returns {boolean}
 */
function isWorth(pet) {
  const { amount, rareDegree } = pet;
  if (amount <= config.threshold[rareDegree]) {
    console.warn(`发现一只值得买的狗!稀有度为：${RARE_DEGREE[rareDegree]}；价格为：${amount}`);
    return true;
  }
}

/**
 * 通过百度云 ORC 识别验证码
 *
 * @param {string} img - Base64 格式验证码图片
 */
function recognizeCaptcha(img) {
  return client.accurateBasic(img, { language_type: 'ENG', detect_direction: true });
}

/**
 * 获取键盘输入的验证码
 *
 * @returns {Promise}
 */
function getCaptcha() {
  return new Promise((resolve, reject) => {
    prompt.get('captcha', function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

async function letUsGo() {
  // 查询在售的狗
  let res = await axiosInstance.post(URL_ON_SALE, {
    'pageNo': 1,
    'pageSize': 10,
    'querySortType': 'AMOUNT_ASC',
    'petIds': [],
    'lastAmount': null,
    'lastRareDegree': null,
    'requestId': Date.now(),
    'appId': 1,
    'tpl': ''
  });
  console.log(`第${++count}次查询`);

  const pets = res.data.data.petsOnSale;
  for (let i = pets.length - 1; i >= 0; i--) {
    const pet = pets[i];
    if (!isWorth(pet)) {
      continue;
    }

    // 获取验证码
    res = await axiosInstance.post(URL_CAPTCHA, {
      'requestId': Date.now(),
      'appId': 1,
      'tpl': ''
    });

    // 识别验证码
    const captchaData = res.data.data;
    fs.writeFileSync(IMAGE_PATH, captchaData.img, 'base64');
    let captcha;
    if (false) {
      const result = await recognizeCaptcha(captchaData.img);
      if (result.error_code) {
        console.warn('失败验证码出错', result.error_msg);
        continue;
      } else {
        captcha = result.words_result[0].words.replace(/\s/g, '');
        console.log('成功识别验证码', captcha);
      }
    } else {
      // 人工识别
      prompt.start();
      const result = await getCaptcha();
      captcha = result.captcha;
    }

    // 买狗
    console.log('开始买狗...');
    res = await axiosInstance.post(URL_BUY, {
      'validCode': pet.validCode,
      'seed': captchaData.seed,
      'captcha': captcha,
      'petId': pet.petId,
      'requestId': Date.now(),
      'amount': pet.amount,
      'appId': 1,
      'tpl': ''
    });
    console.log('购买结果', JSON.stringify(res.data));
  }
}

function sleep(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

let count = 0;

async function start() {
  while (true) {
    try {
      await sleep(1500);
      await letUsGo();
    } catch (err) {
      console.warn(err.message);
    }
  }
}

start();