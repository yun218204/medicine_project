const express = require("express"); //引入 express 模組
const app = express();
const session = require("express-session");
require("dotenv").config();
//新聞fun
let cachedNews = []; // 新聞更新進來後就存進來
let lastFetched = 0; // 上次更新時間

async function fetchNews() {
  const API_KEY = process.env.GNEWS_API_KEY;
  const newsUrl = `https://gnews.io/api/v4/top-headlines?country=tw&lang=zh&category=health&max=3&apikey=${API_KEY}`;
  //抓取台灣繁體中文類別為健康的前三筆最新新聞
  try {
    const response = await fetch(newsUrl); //發送 HTTP 請求
    const data = await response.json(); //整個 JSON 資料
    const fixedImage = "/img/news.jpg";
    cachedNews = (data.articles || []).slice(0, 3).map((article) => ({
      //articles有值就用 最多取前三比
      ...article, //articles裡面有很多article陣列資料
      image: fixedImage, //因為我只要蓋掉圖片保留其他內容 就展開複製就好
    }));
    lastFetched = Date.now(); //紀錄這次新聞更新的時間
    console.log("已更新健康新聞快取");
  } catch (err) {
    console.error(" 抓取新聞失敗", err);
  }
}

// 啟動時立即抓一次新聞
fetchNews();

// 每 1 小時自動抓一次
setInterval(fetchNews, 60 * 60 * 1000);

app.use(
  session({
    secret: "your-secret-key", // 秘鑰
    resave: false, // 如果 session 沒有變更就不要重新儲存到伺服器
    saveUninitialized: true, // 是否儲存沒修改過的 session
  })
);
const path = require("path"); //專門處理路徑
const db = require("./db"); //引入我的資料庫檔案
const bcrypt = require("bcrypt"); //用來加密密碼

app.use(express.urlencoded({ extended: true })); //解析表單送來的資料
app.use(express.json()); //解析json (fetch或axios)
app.use(express.static("public"));
db.query("SELECT * FROM users", (err, rows) => {
  if (err) {
    console.error("查詢失敗：", err);
    return;
  }
  console.log("查詢結果：", rows);
}); //查詢資料表

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); //ejs 檔案放在views資料夾裡__dirname 代表目前這支程式所在的資料夾
app.use(express.static(path.join(__dirname, "public"))); //設定 public資料夾為靜態資源區 裡面放的 CSS、圖片、JavaScript 都可以被瀏覽器直接載入

app.get("/", async (req, res) => {
  const username = req.session.nickname || null;
  //健康小知識
  const tips = [
    { zh: "多喝水有助新陳代謝", en: "Drinking more water helps metabolism" },
    {
      zh: "每天走路 30 分鐘有益心血管健康",
      en: "Walking 30 minutes a day benefits heart health",
    },
    {
      zh: "深綠色蔬菜富含鐵與葉酸",
      en: "Dark green vegetables are rich in iron and folate",
    },
    {
      zh: "睡眠不足會影響免疫系統",
      en: "Lack of sleep weakens the immune system",
    },
    {
      zh: "飲食應均衡攝取蛋白質、纖維與好油脂",
      en: "Eat a balanced diet with protein, fiber, and healthy fats",
    },
    {
      zh: "每天曬太陽 10 分鐘有助維生素 D 合成",
      en: "10 minutes of sunlight daily boosts vitamin D synthesis",
    },
    {
      zh: "控制糖分攝取可降低糖尿病風險",
      en: "Reducing sugar intake lowers diabetes risk",
    },
    {
      zh: "常吃加工食品會增加心臟病風險",
      en: "Processed foods increase the risk of heart disease",
    },
    {
      zh: "每週至少運動 3 次可改善情緒與睡眠",
      en: "Exercising 3 times a week improves mood and sleep",
    },
    {
      zh: "抽菸會傷害肺部與血管",
      en: "Smoking damages lungs and blood vessels",
    },
    {
      zh: "笑能釋放壓力與增強免疫力",
      en: "Laughter reduces stress and boosts immunity",
    },
    {
      zh: "良好坐姿能避免腰酸背痛",
      en: "Good posture prevents back and neck pain",
    },
    { zh: "飯後散步有助消化", en: "Walking after meals aids digestion" },
    {
      zh: "規律作息對身心健康至關重要",
      en: "A regular routine is vital for mental and physical health",
    },
    {
      zh: "避免長時間滑手機，保護眼睛與頸椎",
      en: "Limit screen time to protect eyes and neck",
    },
  ];
  //空氣品質api
  const API_KEY = "07c57ad3-a5c6-43f0-8bec-c35c82369d7d";
  let aqiData = {};
  try {
    const apiUrl = `https://data.moenv.gov.tw/api/v2/aqx_p_432?api_key=${API_KEY}&limit=1000&sort=ImportDate desc&format=JSON`;
    const response = await fetch(apiUrl);
    const json = await response.json();
    const records = json.records;

    const countyAQI = {};
    records.forEach((item) => {
      const county = item.county;
      const aqi = parseInt(item.aqi);
      if (!isNaN(aqi)) {
        if (!countyAQI[county]) countyAQI[county] = [];
        countyAQI[county].push(aqi);
      }
    });
    for (const county in countyAQI) {
      const list = countyAQI[county];
      const avg = Math.round(list.reduce((a, b) => a + b, 0) / list.length);
      aqiData[county] = avg;
    }
  } catch (err) {
    console.error("AQI 抓取失敗：", err);
    aqiData = {};
  }
  //如果未登入
  if (!req.session.username) {
    return res.render("index", {
      username,
      logs: [],
      news: cachedNews,
      tips,
      aqiData,
    });
  }

  const sql =
    "SELECT * FROM medicine_log WHERE username = ? ORDER BY created_at DESC";
  db.query(sql, [req.session.username], (err, result) => {
    if (err) {
      console.error("查詢紀錄失敗：", err);
      return res.render("index", {
        username,
        logs: [],
        news: cachedNews,
        tips,
        aqiData,
      });
    }

    // 成功：有帳號紀錄新聞
    res.render("index", {
      username,
      logs: result,
      news: cachedNews,
      tips,
      aqiData,
    });
  });
});

//註冊頁面功能
app.get("/register", (req, res) => {
  res.render("register");
});
//處理註冊邏輯
app.post("/register", async (req, res) => {
  const { username, password, nickname } = req.body; //從前端抓取這三個輸入欄位
  console.log(req.body);
  const hashedPassword = await bcrypt.hash(password, 10); //密碼加密10層
  //資料庫邏輯
  const sql = "INSERT INTO users(username,password,nickname) VALUES(?,?,?)"; //把這三個加進users表格
  db.query(sql, [username, hashedPassword, nickname], (err, result) => {
    //執行sql 陣列依序塞入 ?
    if (err) {
      console.error("註冊失敗：", err);
      return res.send("註冊失敗，帳號重複");
    }
    console.log("註冊成功：", result.insertId);
    res.redirect("/login"); //註冊成功就跳轉到登入
  });
});

//登入邏輯

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const sql = "SELECT * FROM users WHERE username = ?";
  db.query(sql, [username], async (err, result) => {
    //查詢要時間 所以用這個
    if (err) {
      console.error("查詢錯誤：", err);
      return res.send("系統錯誤");
    }

    if (result.length === 0) {
      //看有沒有這筆資料
      return res.send("帳號不存在");
    }
    const user = result[0]; //因為帳號不會重複 所以只會查出一筆資料 就是[0]
    const passwordMatch = await bcrypt.compare(password, user.password); //比對密碼是否正確
    if (!passwordMatch) {
      return res.send(" 密碼錯誤");
    }

    // 登入成功記住使用者狀態存在 session
    req.session.username = user.username; //右邊 資料庫查出來的帳號 因為result查出來的是陣列 所以可以這樣
    req.session.nickname = user.nickname; // 左邊 我自己幫 session 記住帳號 (我建立一個空session 把我result查出來的陣列物件資料帶進去)

    console.log("登入成功！使用者：", user.nickname);

    res.redirect("/");
  });
});
//做登出
app.get("/logout", (req, res) => {
  const nickname = req.session.nickname; //  登出前先存起來！

  req.session.destroy(() => {
    console.log(nickname + " 您已登出");
    res.redirect("/");
  });
});
//做只要有登入才能使用
app.post("/record", (req, res) => {
  if (!req.session.username) {
    return res.status(401).send("請先登入再使用");
  }
  const { medicine_name } = req.body;
  const username = req.session.username;
  const sql =
    "INSERT INTO medicine_log (username, medicine_name) VALUES (?, ?)";
  db.query(sql, [username, medicine_name], (err, result) => {
    if (err) {
      console.error("新增紀錄失敗：", err);
      return res.status(500).send("伺服器錯誤");
    }
    res.send("紀錄成功！");
  });
});

//吃藥分頁
app.get("/medicinerecord", (req, res) => {
  if (!req.session.nickname) {
    return res.redirect("/login");
  }

  const sql =
    "SELECT * FROM medicine_log WHERE username = ? ORDER BY created_at DESC";
  db.query(sql, [req.session.username], (err, result) => {
    if (err) {
      console.error("查詢紀錄失敗：", err);
      return res.render("medicinerecord", {
        nickname: req.session.nickname,
        logs: [], // 回傳空陣列避免爆破
      });
    }

    res.render("medicinerecord", {
      nickname: req.session.nickname,
      logs: result, //把查出來的資料叫做 logs 丟進 EJS
    });
  });
});

// 刪除指定紀錄（只允許刪自己的）
app.delete("/record/:id", (req, res) => {
  if (!req.session.username) {
    return res.status(401).send("請先登入");
  }

  const id = req.params.id;
  const username = req.session.username;

  const sql = "DELETE FROM medicine_log WHERE id = ? AND username = ?";
  db.query(sql, [id, username], (err, result) => {
    if (err) {
      console.error("刪除紀錄失敗：", err);
      return res.status(500).send("伺服器錯誤");
    }

    if (result.affectedRows === 0) {
      return res.status(404).send("紀錄不存在或無權限刪除");
    }

    res.send("刪除成功！");
  });
});
//養生專欄
app.get("/healthy", (req, res) => {
  res.render("healthy");
});
//監聽3000
app.listen(3000, () => {
  console.log("伺服器啟動：http://localhost:3000");
});
