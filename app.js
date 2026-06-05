document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnConvert = document.getElementById('btn-convert');
    const btnClear = document.getElementById('btn-clear');
    const btnCopyAll = document.getElementById('btn-copy-all');
    
    const statusBadge = document.getElementById('status-badge');
    const statusText = document.getElementById('status-text');
    const livePreview = document.getElementById('live-preview');
    const recognizedTextArea = document.getElementById('recognized-text');
    
    const sContent = document.getElementById('s-content');
    const oContent = document.getElementById('o-content');
    const aContent = document.getElementById('a-content');
    const pContent = document.getElementById('p-content');
    const uContent = document.getElementById('u-content');
    
    const copyButtons = document.querySelectorAll('.btn-copy-card');
    const toastContainer = document.getElementById('toast-container');

    // --- State Variables ---
    let recognition = null;
    let isRecording = false;
    let finalTranscript = ''; // 確定したテキストの蓄積

    // --- Keywords Definition ---
    const soapKeywords = {
        S: ['痛い', 'つらい', 'しびれる', 'だるい', '動かしにくい', '不安', '眠れない', '訴え', '伝え'],
        O: ['ROM', 'MMT', '度', 'cm', 'kg', 'mmHg', '回', '秒', '歩行', '握力', 'バイタル', '腫脹', '熱感', '発赤', '伸展', '進展', '屈曲', '筋力', '血圧', '心拍', '脈拍', '体温', '酸素', 'SpO2'],
        A: ['考えられる', '原因', '問題', '改善', '低下', '制限', 'リスク', '評価', '困難', '維持', '向上', '疑い'],
        P: ['プログラム', '目標', '実施', '継続', '指導', '週', '回', 'セット', '退院', '自主トレ', '訓練', 'リハビリ', 'プラン', '検討']
    };

    // --- Toast Notification ---
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = '<i class="fa-solid fa-info-circle"></i>';
        if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
        if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation"></i>';
        
        toast.innerHTML = `${icon} <span>${message}</span>`;
        toastContainer.appendChild(toast);
        
        // アニメーション完了後にDOMから削除
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // --- Web Speech API Initialization ---
    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            showToast('お使いのブラウザは音声認識に対応していません。Google Chromeなどをお試しください。', 'error');
            btnStart.disabled = true;
            return false;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = true;       // 連続認識を有効化
        recognition.interimResults = true;    // 途中の暫定結果も取得
        recognition.lang = 'ja-JP';            // 言語は日本語

        // 録音開始イベント
        recognition.onstart = () => {
            isRecording = true;
            statusBadge.className = 'status-badge recording';
            statusText.textContent = '録音中';
            btnStart.disabled = true;
            btnStop.disabled = false;
            showToast('音声認識を開始しました。マイクに向かって話してください。', 'success');
        };

        // 認識結果取得イベント
        recognition.onresult = (event) => {
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const result = event.results[i];
                if (result.isFinal) {
                    const text = result[0].transcript;
                    // 句読点がない場合に自動で「。」を補う（自然な文章にするため）
                    const formattedText = text.trim().endsWith('。') || text.trim().endsWith('？') ? text : text + '。';
                    finalTranscript += formattedText;
                } else {
                    interimTranscript += result[0].transcript;
                }
            }

            // リアルタイムプレビューの更新
            livePreview.textContent = interimTranscript;
            
            // 全体テキストエリアの更新 (確定したテキスト + 暫定テキスト)
            const currentTextAreaValue = recognizedTextArea.value.trim();
            // ユーザーの手動入力がある場合を考慮し、末尾に追記する形で連動させる
            // ただし、単純な上書きだと編集内容が消えるため、音声認識由来のテキストをベースにする
            recognizedTextArea.value = finalTranscript + interimTranscript;
            // スクロールを最下部に
            recognizedTextArea.scrollTop = recognizedTextArea.scrollHeight;
        };

        // エラー発生イベント
        recognition.onerror = (event) => {
            console.error('Speech Recognition Error:', event.error);
            if (event.error === 'not-allowed') {
                showToast('マイクの使用が許可されていません。ブラウザの設定を確認してください。', 'error');
                stopRecording();
            } else if (event.error === 'no-speech') {
                // 無音による一時停止はエラーとせずスルーすることが多いが、警告表示
                console.log('音声が検知されませんでした。');
            } else {
                showToast(`音声認識エラー: ${event.error}`, 'error');
                stopRecording();
            }
        };

        // 録音終了イベント
        recognition.onend = () => {
            // 意図しない停止（ネットワーク切断や無音での自動切断など）が発生した場合の自動再起動
            if (isRecording) {
                console.log('音声認識が自動停止したため、再起動します。');
                try {
                    recognition.start();
                } catch (e) {
                    console.error('再起動に失敗しました:', e);
                }
            } else {
                statusBadge.className = 'status-badge idle';
                statusText.textContent = '待機中';
                btnStart.disabled = false;
                btnStop.disabled = true;
                livePreview.textContent = '';
                showToast('録音を停止しました。認識結果を確認してください。');
            }
        };

        return true;
    }

    // --- Control Functions ---
    function startRecording() {
        if (!recognition) {
            const initialized = initSpeechRecognition();
            if (!initialized) return;
        }

        // 音声入力開始時にテキストエリアを初期化するか確認（追記したい場合もあるためクリアはしないが、初期状態ならクリア）
        if (recognizedTextArea.value === '') {
            finalTranscript = '';
        } else {
            // テキストエリアに既存の文章がある場合は、それを確定バッファの初期値とする
            // 最後に「。」がない場合は補完
            let existingText = recognizedTextArea.value.trim();
            if (existingText && !existingText.endsWith('。') && !existingText.endsWith('？')) {
                existingText += '。';
            }
            finalTranscript = existingText;
        }

        try {
            recognition.start();
        } catch (e) {
            console.error('音声認識の起動に失敗しました:', e);
            showToast('音声認識の起動に失敗しました。もう一度お試しください。', 'error');
        }
    }

    function stopRecording() {
        isRecording = false;
        if (recognition) {
            recognition.stop();
        }
    }

    // --- Smart Split Logic ---
    function smartSplit(text) {
        // 1. 文頭の不要な記号やスペースを削除
        let processed = text.replace(/^[。、\s\?？]+/, '');

        // 2. 「です」「ます」等の文末表現の直後に句読点がない場合、「。」を追加
        processed = processed.replace(/(です|ます|ました|でした|ください|ています|ていました|とのこと|だそうです|と言っています|と訴えています|考えられます|思われます|見られます)(?![。？?\n])/g, '$1。');
        
        // 3. 「。」や「？」や改行で一旦分割
        let initialSegments = processed.split(/[。？?\n]+/).map(s => s.trim()).filter(s => s.length > 0);
        
        let finalSentences = [];
        
        initialSegments.forEach(segment => {
            // 英数字間のスペースを退避 (例: "ROM EX", "Stage 4")
            let temp = segment.replace(/([A-Za-z0-9]+)\s+([A-Za-z0-9]+)/g, '$1__SPACE__$2');
            
            // スペースで分割
            let tokens = temp.split(/[\s　]+/).map(t => t.replace(/__SPACE__/g, ' ')).filter(t => t.length > 0);
            
            if (tokens.length === 0) return;
            
            let mergedTokens = [];
            let current = tokens[0];
            
            for (let i = 1; i < tokens.length; i++) {
                let next = tokens[i];
                
                // 結合判定フラグ
                const startWithParticle = /^[はがをにともでや]/.test(next); // 助詞で始まる
                const startWithNumberOrUnit = /^[0-9０-９度c㎡kH回秒セ]/.test(next); // 数字や単位で始まる
                const currentEndsWithConnective = /[のなとで]$/.test(current) || /(屈曲|伸展|進展|マイナス|プラス|レベル|ステージ|ステージング)$/.test(current); // 接続的な語尾
                
                if (startWithParticle || startWithNumberOrUnit || currentEndsWithConnective) {
                    current += '' + next; // スペースを消して結合
                } else {
                    mergedTokens.push(current);
                    current = next;
                }
            }
            mergedTokens.push(current);
            
            finalSentences.push(...mergedTokens);
        });
        
        return finalSentences.map(s => s.trim()).filter(s => s.length > 0);
    }

    // --- SOAP Classification Logic ---
    function convertToSOAP() {
        const text = recognizedTextArea.value.trim();
        if (!text) {
            showToast('変換するテキストがありません。音声を録音するか、直接テキストを入力してください。', 'error');
            return;
        }

        // 改良したスマート分割ロジックを使用してテキストを文脈ごとに分割
        const sentences = smartSplit(text);

        const soapLists = {
            S: [],
            O: [],
            A: [],
            P: [],
            U: [] // Unclassified (未分類)
        };

        sentences.forEach(sentence => {
            // 表示用に、末尾が句点で終わっていなければ「。」を付与
            const displaySentence = sentence.endsWith('。') || sentence.endsWith('？') ? sentence : sentence + '。';
            
            // 優先判定フロー: P ➔ A ➔ S ➔ O
            // 1. P (計画)
            if (soapKeywords.P.some(keyword => sentence.includes(keyword))) {
                soapLists.P.push(displaySentence);
            } 
            // 2. A (評価・分析)
            else if (soapKeywords.A.some(keyword => sentence.includes(keyword))) {
                soapLists.A.push(displaySentence);
            } 
            // 3. S (主観的情報)
            else if (soapKeywords.S.some(keyword => sentence.includes(keyword))) {
                soapLists.S.push(displaySentence);
            } 
            // 4. O (客観的情報)
            else if (soapKeywords.O.some(keyword => sentence.includes(keyword))) {
                soapLists.O.push(displaySentence);
            } 
            // 5. 未分類
            else {
                soapLists.U.push(displaySentence);
            }
        });

        // 画面への書き出し
        renderSoapCard(sContent, soapLists.S);
        renderSoapCard(oContent, soapLists.O);
        renderSoapCard(aContent, soapLists.A);
        renderSoapCard(pContent, soapLists.P);
        renderSoapCard(uContent, soapLists.U);

        showToast('SOAP形式への変換が完了しました！', 'success');
    }

    function renderSoapCard(element, list) {
        element.innerHTML = '';
        if (list.length === 0) {
            element.innerHTML = '<li class="empty-placeholder">該当する情報がありません。</li>';
        } else {
            list.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                element.appendChild(li);
            });
        }
    }

    // --- Copy Functions ---
    function copyTextToClipboard(text) {
        if (!navigator.clipboard) {
            // 古いブラウザ向けのフォールバック
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                showToast('クリップボードにコピーしました。', 'success');
            } catch (err) {
                showToast('コピーに失敗しました。', 'error');
            }
            document.body.removeChild(textArea);
            return;
        }

        navigator.clipboard.writeText(text)
            .then(() => {
                showToast('クリップボードにコピーしました。', 'success');
            })
            .catch(err => {
                console.error('Copy error:', err);
                showToast('コピーに失敗しました。', 'error');
            });
    }

    // 単一カードのコピー処理
    function copyCardContent(targetId) {
        const listItems = document.querySelectorAll(`#${targetId} li`);
        if (listItems.length === 0 || listItems[0].classList.contains('empty-placeholder')) {
            showToast('コピーするデータがありません。', 'error');
            return;
        }

        const textToCopy = Array.from(listItems)
            .map(li => li.textContent)
            .join('\n');
            
        copyTextToClipboard(textToCopy);
    }

    // 全カードのコピー処理 (SOAP形式フォーマット)
    function copyAllSoap() {
        const categories = [
            { label: '【S】Subjective (主観的情報)', id: 's-content' },
            { label: '【O】Objective (客観的情報)', id: 'o-content' },
            { label: '【A】Assessment (評価・分析)', id: 'a-content' },
            { label: '【P】Plan (治療・指導計画)', id: 'p-content' },
            { label: '【未分類】Unclassified', id: 'u-content' }
        ];

        let formattedText = '■ 音声入力SOAPノート 変換結果\n\n';
        let hasData = false;

        categories.forEach(cat => {
            const listItems = document.querySelectorAll(`#${cat.id} li`);
            if (listItems.length > 0 && !listItems[0].classList.contains('empty-placeholder')) {
                hasData = true;
                formattedText += `${cat.label}\n`;
                listItems.forEach(li => {
                    formattedText += `・ ${li.textContent}\n`;
                });
                formattedText += '\n';
            }
        });

        if (!hasData) {
            showToast('コピーする変換結果がありません。先にSOAP変換を実行してください。', 'error');
            return;
        }

        copyTextToClipboard(formattedText.trim());
    }

    // --- Reset ---
    function clearAll() {
        if (confirm('入力テキストとSOAP分類結果をすべてクリアしますか？')) {
            recognizedTextArea.value = '';
            livePreview.textContent = '';
            finalTranscript = '';
            
            // カードの初期化
            const lists = [sContent, oContent, aContent, pContent, uContent];
            lists.forEach(list => {
                list.innerHTML = '<li class="empty-placeholder">該当する情報がありません。</li>';
            });
            
            showToast('すべての内容をクリアしました。');
        }
    }

    // --- Event Listeners ---
    btnStart.addEventListener('click', startRecording);
    btnStop.addEventListener('click', stopRecording);
    btnConvert.addEventListener('click', convertToSOAP);
    btnClear.addEventListener('click', clearAll);
    btnCopyAll.addEventListener('click', copyAllSoap);

    // 各カードの個別コピーボタンの制御
    copyButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // ボタン自体、または中のアイコンがクリックされるため、確実に button 要素から target を取得
            const button = e.currentTarget;
            const targetId = button.getAttribute('data-target');
            copyCardContent(targetId);
        });
    });

    // 初期起動時のブラウザ確認
    initSpeechRecognition();
});
