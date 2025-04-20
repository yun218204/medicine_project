const express = require("express"); //引入 express 模組
const app = express();
const session = require("express-session");
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

app.get("/", (req, res) => {
  //res.render("index", { username: req.session.nickname || null }); //如果 req.session.nickname 有值就用 沒有就null
  const username = req.session.nickname || null;

  if (!req.session.username) {
    // 未登入傳空logs
    return res.render("index", { username, logs: [] });
  }

  // 已登入從資料庫查詢
  const sql =
    "SELECT * FROM medicine_log WHERE username = ? ORDER BY created_at DESC";
  db.query(sql, [req.session.username], (err, result) => {
    if (err) {
      console.error("查詢紀錄失敗：", err);
      return res.render("index", { username, logs: [] }); // 錯誤也傳空
    }

    //  成功取得紀錄
    res.render("index", { username, logs: result }); // ← logs 一定要傳！
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
    console.log(nickname + " 您已登出"); // 現在就不會錯了
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
//監聽3000
app.listen(3000, () => {
  console.log("伺服器啟動：http://localhost:3000");
});
