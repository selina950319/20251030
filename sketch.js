// 變數與狀態初始化
let questions = []; // 儲存解析後的題目 (已打亂選項)
let fullQuestionPool = []; // 儲存從 CSV 載入的全部題目
let currentQuestionIndex = 0;
let score = 0;
let gameState = 'LOADING'; // 狀態: 'LOADING', 'QUIZ', 'RESULT', 'ERROR'
let resultMessage = ''; // 儲存答題後的短暫訊息

// --- 新增：作答回饋訊息的隨機位置 ---
let feedbackX; 
let feedbackY; 

// --- 設定 ---
const QUESTIONS_TO_PICK = 4; // 每次測驗抽取的題目數量

// --- 特效相關變數 ---
let mouseTrail = []; // 游標軌跡
const MAX_TRAIL_LENGTH = 15;
let selectionEffectTimer = 0; // 選項選取時的特效計時器

// 結果動畫相關
let resultAnimationTimer = 0;
const ANIMATION_DURATION = 150; // 幀數或時間單位

function setup() {
    // 使用 windowWidth/Height 確保響應性
    // 修正: 移除最大尺寸限制，使畫布能填滿視窗
    createCanvas(windowWidth - 20, windowHeight - 20);
    // 嘗試使用 p5.js 的 loadStrings 讀取本地 CSV
    loadStrings('questions.csv', csvLoaded, csvError);
    // 設置文字相關屬性
    textAlign(LEFT, TOP);
    textFont('Inter', 18);
}

// 重新調整視窗大小時自動調整 canvas
function windowResized() {
    // 修正: 移除最大尺寸限制，使畫布能填滿視窗
    resizeCanvas(windowWidth - 20, windowHeight - 20);
}

function csvError(e) {
    console.error("CSV 檔案載入錯誤:", e);
    gameState = 'ERROR';
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = floor(random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function csvLoaded(data) {
    fullQuestionPool = []; // 清空全部題庫

    if (data.length > 1) { 
        for (let i = 1; i < data.length; i++) {
            let parts = data[i].split(',');
            
            // 由於 CSV 可能有複雜的引號和逗號，這裡簡化處理並確保欄位數正確
            if (parts.length === 6) {
                fullQuestionPool.push({
                    q: parts[0].replace(/"/g, '').trim(),
                    a: parts[1].replace(/"/g, '').trim(),
                    b: parts[2].replace(/"/g, '').trim(),
                    c: parts[3].replace(/"/g, '').trim(),
                    d: parts[4].replace(/"/g, '').trim(),
                    correct: parts[5].replace(/"/g, '').trim()
                });
            } else if (data[i].trim() !== "") {
                 console.warn(`第 ${i+1} 行欄位數量不正確 (${parts.length} 個)，已略過。`);
            }
        }
        
        if (fullQuestionPool.length > 0) {
            startNewQuiz(); // 啟動新測驗
            console.log(`成功從題庫載入 ${fullQuestionPool.length} 題。`);
        } else {
            console.error("CSV 資料讀取成功，但題目陣列為空。");
            gameState = 'ERROR';
        }

    } else {
        console.error("CSV 檔案載入失敗或為空。");
        gameState = 'ERROR';
    }
}

function startNewQuiz() {
    questions = [];
    currentQuestionIndex = 0;
    score = 0;

    // 1. 隨機抽取 QUESTIONS_TO_PICK 題
    let poolCopy = [...fullQuestionPool];
    shuffleArray(poolCopy);
    const selectedQuestions = poolCopy.slice(0, QUESTIONS_TO_PICK);

    // 2. 處理每個題目的選項打亂
    selectedQuestions.forEach(qData => {
        let options = [
            { key: 'A', text: qData.a },
            { key: 'B', text: qData.b },
            { key: 'C', text: qData.c },
            { key: 'D', text: qData.d }
        ];

        // 將選項陣列打亂
        shuffleArray(options);

        questions.push({
            q: qData.q,
            shuffledOptions: options, // 儲存打亂後的選項
            originalCorrectKey: qData.correct // 儲存正確答案的原始 key (A, B, C, D)
        });
    });

    gameState = 'QUIZ';
}

function draw() {
    background(240);

    if (gameState === 'LOADING') {
        textAlign(CENTER, CENTER);
        textSize(32);
        text('測驗系統載入中...', width / 2, height / 2);
    } else if (gameState === 'QUIZ') {
        drawQuiz();
        drawCursorTrail();
        drawSelectionFeedback();
    } else if (gameState === 'RESULT') {
        drawResultAnimation();
        drawCursorTrail();
    } else if (gameState === 'ERROR') {
        textAlign(CENTER, CENTER);
        textSize(20);
        text('載入錯誤！請檢查 CSV 檔案格式與本地伺服器設定。', width / 2, height / 2);
    }
}

function drawQuiz() {
    if (currentQuestionIndex >= questions.length) {
        gameState = 'RESULT';
        resultAnimationTimer = 0; 
        return;
    }

    const qData = questions[currentQuestionIndex];
    const currentQNum = currentQuestionIndex + 1;
    
    // --- 響應式配置變數 ---
    const isMobile = width < 550; // 響應式斷點
    const margin = isMobile ? 20 : 50;
    const btnHeight = isMobile ? 50 : 60;
    const spacingY = isMobile ? 65 : 80;
    const startY = isMobile ? 180 : 220;
    
    let btnWidth;
    if (isMobile) {
        btnWidth = width - margin * 2; // 1欄：按鈕佔滿寬度
    } else {
        btnWidth = (width - margin * 3) / 2; // 2欄：兩個按鈕中間留一個 margin
    }
    // --- 結束響應式配置 ---

    // 顯示問題編號與分數 (文字大小隨寬度縮放)
    fill(50);
    textSize(map(width, 400, 800, 16, 20));
    textAlign(LEFT, TOP);
    text(`問題 ${currentQNum} / ${questions.length} | 分數: ${score}`, margin, margin);

    // 顯示問題 (文字大小隨寬度縮放)
    textSize(map(width, 400, 800, 22, 30));
    textStyle(BOLD);
    text(qData.q, margin, startY - 100, width - margin * 2, 100);
    textStyle(NORMAL);

    // 選項按鈕
    const options = qData.shuffledOptions;
    const displayLabels = ['A', 'B', 'C', 'D'];

    for (let i = 0; i < options.length; i++) {
        let x, y;
        
        if (isMobile) {
            // 1 欄位 (手機模式)
            x = margin;
            y = startY + i * spacingY;
        } else {
            // 2 欄位 (桌面模式)
            x = (i % 2 === 0) ? margin : (margin * 2 + btnWidth);
            y = startY + floor(i / 2) * spacingY;
        }
        
        const optionText = options[i].text;

        // 選項選取特效 (懸停/游標特效)
        if (isMouseOverOption(x, y, btnWidth, btnHeight)) {
            fill(180, 200, 255); 
            stroke(0, 100, 255);
            strokeWeight(4);
            cursor(HAND);
        } else {
            fill(255);
            stroke(150);
            strokeWeight(1);
            cursor(ARROW);
        }

        rect(x, y, btnWidth, btnHeight, 12); 

        // 選項內容
        fill(50);
        textSize(map(width, 400, 800, 16, 18)); // 選項文字大小隨寬度縮放
        textStyle(BOLD);
        text(`${displayLabels[i]}: `, x + 15, y + 20);
        textStyle(NORMAL);
        text(optionText, x + 45, y + 20, btnWidth - 55, btnHeight - 10);
    }
    
    // 顯示短暫的作答回饋訊息
    if (resultMessage && feedbackX !== undefined && feedbackY !== undefined) {
        fill(50, 50, 200); 
        textSize(24);
        textAlign(CENTER, TOP); 
        text(resultMessage, feedbackX, feedbackY);
    }
}

function isMouseOverOption(x, y, w, h) {
    return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
}

function drawCursorTrail() {
    mouseTrail.push(createVector(mouseX, mouseY));
    if (mouseTrail.length > MAX_TRAIL_LENGTH) {
        mouseTrail.shift();
    }

    noStroke();
    for (let i = 0; i < mouseTrail.length; i++) {
        let pos = mouseTrail[i];
        let alpha = map(i, 0, mouseTrail.length - 1, 0, 150);
        let size = 15 - i * 0.8;
        
        if (cursor() === HAND) {
            fill(255, 100, 150, alpha + 50); 
            size *= 1.2;
        } else {
            fill(100, 150, 255, alpha); 
        }
        
        ellipse(pos.x, pos.y, size, size); 
    }
}

function drawSelectionFeedback() {
    if (selectionEffectTimer > 0) {
        let alpha = map(selectionEffectTimer, 0, 60, 200, 0);
        let size = map(selectionEffectTimer, 0, 60, 50, width * 0.8);
        
        noFill();
        stroke(0, 200, 255, alpha);
        strokeWeight(10);
        ellipse(mouseX, mouseY, size, size); 
        
        selectionEffectTimer--;
    }
}

function drawResultAnimation() {
    resultAnimationTimer++;
    const currentQ = questions.length;
    const percentage = currentQ > 0 ? score / currentQ : 0;
    let title = "";
    let message = "";
    let baseColor;
    let particleColor;

    // 評分邏輯 (與舊版相同)
    if (percentage === 1.0) {
        title = "🎉 滿分通過！太棒了！ 💯";
        message = "你對這些知識瞭若指掌，簡直是天才！";
        baseColor = color(100, 255, 100, 255); 
        particleColor = color(255, 255, 0); 
    } else if (percentage >= 0.75) { 
        title = "👍 表現優秀！";
        message = `答對 ${score} 題，繼續保持！`;
        baseColor = color(100, 200, 255, 255); 
        particleColor = color(255, 255, 255); 
    } else if (percentage >= 0.5) { 
        title = "😊 繼續努力！";
        message = `答對 ${score} 題，掌握了基礎，再複習一下！`;
        baseColor = color(255, 200, 100, 255); 
        particleColor = color(255, 150, 50); 
    } else {
        title = "😟 需要再加把勁。";
        message = `答對 ${score} 題，別灰心，回去看看錯的部分！`;
        baseColor = color(255, 100, 100, 255); 
        particleColor = color(150, 150, 150); 
    }

    // --- 動畫邏輯 (波紋擴散與粒子效果) ---
    let time = resultAnimationTimer;
    let waveScale = (time % 100) / 100;

    let bgColor = color(red(baseColor), green(baseColor), blue(baseColor), 200);
    background(bgColor);
    
    noFill();
    stroke(255, 255, 255, 255 - waveScale * 255);
    strokeWeight(15 * (1 - waveScale));
    ellipse(width / 2, height / 2, waveScale * width * 1.5, waveScale * height * 1.5);

    // 中心文字
    textAlign(CENTER, CENTER);
    textSize(50);
    fill(0);
    text(title, width / 2, height / 2 - 50);

    textSize(24);
    text(message, width / 2, height / 2 + 20);

    // 顯示分數
    textSize(36);
    text(`最終得分: ${score}/${currentQ}`, width / 2, height / 2 + 80);

    randomSeed(300); 
    for(let i = 0; i < 50; i++) {
        let x = random(width);
        let y = random(height);
        let alpha = random(100, 255);
        let flicker = sin(time * 0.1 + i) * 0.5 + 0.5; 
        let size = 5 + flicker * 5;

        fill(red(particleColor), green(particleColor), blue(particleColor), alpha * flicker);
        ellipse(x, y, size, size);
    }
    
    // 提示重新開始
    if (resultAnimationTimer > ANIMATION_DURATION * 2) {
        textSize(18);
        fill(50);
        text("點擊螢幕重新開始測驗", width / 2, height - 50);
    }
}

function mousePressed() {
    if (gameState === 'QUIZ' && currentQuestionIndex < questions.length) {
        const qData = questions[currentQuestionIndex];
        const options = qData.shuffledOptions;
        
        // --- 響應式配置變數 (與 drawQuiz 內保持一致) ---
        const isMobile = width < 550;
        const margin = isMobile ? 20 : 50;
        const btnHeight = isMobile ? 50 : 60;
        const spacingY = isMobile ? 65 : 80;
        const startY = isMobile ? 180 : 220;

        let btnWidth;
        if (isMobile) {
            btnWidth = width - margin * 2;
        } else {
            btnWidth = (width - margin * 3) / 2;
        }
        // --- 結束響應式配置 ---
        
        let answerSelected = false;

        for (let i = 0; i < options.length; i++) {
            let x, y;

            if (isMobile) {
                // 1 欄位 (手機模式)
                x = margin;
                y = startY + i * spacingY;
            } else {
                // 2 欄位 (桌面模式)
                x = (i % 2 === 0) ? margin : (margin * 2 + btnWidth);
                y = startY + floor(i / 2) * spacingY;
            }

            if (isMouseOverOption(x, y, btnWidth, btnHeight)) {
                
                const selectedOptionKey = options[i].key; 
                
                // 檢查答案
                if (selectedOptionKey.trim() === qData.originalCorrectKey.trim()) {
                    score++;
                    resultMessage = "✅ 恭喜答對！";
                } else {
                    resultMessage = `❌ 答錯了，正確答案是選項 ${qData.originalCorrectKey}`;
                }
                
                // *** 更新：計算動態的 optionsAreaEnd ***
                // 計算選項區域結束 Y 座標，以便在下方隨機顯示回饋
                const numRows = isMobile ? options.length : ceil(options.length / 2);
                const optionsAreaEnd = startY + numRows * spacingY - (spacingY - btnHeight);
                
                feedbackX = random(width * 0.1, width * 0.9); 
                feedbackY = random(optionsAreaEnd + 30, height - 30); 
                // *** 結束更新 ***

                // 觸發選取特效
                selectionEffectTimer = 60; 

                // 延遲進入下一題
                setTimeout(() => {
                    currentQuestionIndex++;
                    resultMessage = ''; // 清除回饋訊息
                    feedbackX = undefined; // 清除位置
                    feedbackY = undefined;
                }, 1000); 

                answerSelected = true;
                break;
            }
        }

    } else if (gameState === 'RESULT' && resultAnimationTimer > ANIMATION_DURATION * 2) {
        // 重新開始測驗
        startNewQuiz(); 
    }
}
