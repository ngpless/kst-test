// ЭКСПОРТ ВОПРОСОВ В GIFT ФОРМАТ
// ============================================

function exportQuestionsToGIFT(questions) {
    let giftText = '// Экспорт вопросов в формате GIFT\n';
    giftText += `// Дата экспорта: ${new Date().toLocaleString('ru-RU')}\n`;
    giftText += `// Количество вопросов: ${questions.length}\n\n`;

    questions.forEach((q, index) => {
        const questionType = q.type || 'single';

        // Название вопроса с номером и вариантом
        const variantInfo = q.variant ? ` (Вариант ${q.variant})` : '';
        giftText += `::Вопрос ${index + 1}${variantInfo}::`;

        // Текст вопроса
        const questionText = q.text || '';
        giftText += `${escapeGIFT(questionText)} `;

        // Обработка в зависимости от типа вопроса
        if (questionType === 'sequence') {
            // Вопрос на последовательность
            const items = q.items || q.sequenceItems || [];
            giftText += '{\n';
            items.forEach((item, i) => {
                const itemText = typeof item === 'string' ? item : (item.text || '');
                giftText += `  =${i + 1} -> ${escapeGIFT(itemText)}\n`;
            });
            giftText += '}\n\n';
        } else if (questionType === 'match') {
            // Вопрос на сопоставление
            const pairs = q.pairs || [];
            giftText += '{\n';
            pairs.forEach(pair => {
                giftText += `  =${escapeGIFT(pair.left || '')} -> ${escapeGIFT(pair.right || '')}\n`;
            });
            giftText += '}\n\n';
        } else if (questionType === 'short_answer') {
            // Вопрос с коротким ответом
            const correctAnswers = Array.isArray(q.correct) ? q.correct : [q.correct];
            giftText += '{\n';
            correctAnswers.forEach(ans => {
                if (ans) giftText += `  =${escapeGIFT(ans)}\n`;
            });
            giftText += '}\n\n';
        } else if (questionType === 'multiple') {
            // Множественный выбор
            const answers = q.answers || [];
            const correctArr = Array.isArray(q.correct) ? q.correct : (q.correct ? q.correct.split(',') : []);
            giftText += '{\n';
            answers.forEach(answer => {
                const isCorrect = correctArr.includes(answer.letter);
                // В GIFT для multiple choice используем проценты
                const prefix = isCorrect ? `~%${Math.round(100 / correctArr.length)}%` : '~%-100%';
                giftText += `  ${prefix}${escapeGIFT(answer.text || '')}\n`;
            });
            giftText += '}\n\n';
        } else {
            // Одиночный выбор (single)
            const answers = q.answers || [];
            if (answers.length > 0) {
                giftText += '{\n';
                answers.forEach(answer => {
                    const prefix = answer.letter === q.correct ? '=' : '~';
                    giftText += `  ${prefix}${escapeGIFT(answer.text || '')}\n`;
                });
                giftText += '}\n\n';
            } else {
                giftText += '{}\n\n';
            }
        }
    });

    return giftText;
}

// escapeGIFT определена в utils.js

// ============================================
// ПРЕДПРОСМОТР ТЕСТА/ВАРИАНТА
// ============================================

// Предпросмотр всего теста или отфильтрованных вопросов
function previewTest() {
    if (!currentTestForQuestions || currentQuestionsData.length === 0) {
        showError('Нет вопросов для предпросмотра');
        return;
    }

    // Если выбран конкретный вариант - показываем его, иначе все вопросы
    let questionsToPreview = currentQuestionsData;
    let title = currentTestForQuestions.name;

    if (currentVariantFilter !== 'all' && currentVariantFilter !== 'none') {
        questionsToPreview = currentQuestionsData.filter(q => q.variant === currentVariantFilter);
        title += ` - Вариант ${currentVariantFilter}`;
    } else if (currentVariantFilter === 'none') {
        questionsToPreview = currentQuestionsData.filter(q => !q.variant);
        title += ' - Без варианта';
    }

    openPreviewWindow(questionsToPreview, title);
}

// Предпросмотр текущего выбранного варианта
function previewVariant() {
    if (!currentTestForQuestions || currentVariantFilter === 'all' || currentVariantFilter === 'none') {
        return;
    }

    const questionsToPreview = currentQuestionsData.filter(q => q.variant === currentVariantFilter);
    const title = `${currentTestForQuestions.name} - Вариант ${currentVariantFilter}`;

    openPreviewWindow(questionsToPreview, title);
}

// Предпросмотр одного вопроса
function previewSingleQuestion(questionId) {
    const question = currentQuestionsData.find(q => q.id === questionId);
    if (!question) {
        showError('Вопрос не найден');
        return;
    }

    const title = currentTestForQuestions?.name ? `${currentTestForQuestions.name} - Вопрос` : 'Предпросмотр вопроса';
    openPreviewWindow([question], title);
}

// Открытие окна предпросмотра
function openPreviewWindow(questions, title) {
    if (questions.length === 0) {
        showError('Нет вопросов для предпросмотра');
        return;
    }

    const previewWindow = window.open('', '_blank', 'width=900,height=700');
    if (!previewWindow) {
        showError('Не удалось открыть окно. Разрешите всплывающие окна.');
        return;
    }

    const html = generatePreviewHtml(questions, title);
    previewWindow.document.write(html);
    previewWindow.document.close();
}

// Генерация HTML для предпросмотра
function generatePreviewHtml(questions, title) {
    return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Предпросмотр: ${escapeHtml(title)}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .preview-header {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white;
            padding: 20px 30px;
            border-radius: 16px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .preview-header h1 { font-size: 1.4rem; font-weight: 600; }
        .preview-header .info { font-size: 0.9rem; opacity: 0.8; }
        .preview-badge {
            background: rgba(255,255,255,0.2);
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.85rem;
        }
        .question-card {
            background: white;
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .question-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        .question-number {
            background: #1a1a2e;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 0.9rem;
        }
        .question-type {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        .type-single { background: #dbeafe; color: #1d4ed8; }
        .type-multiple { background: #e0e7ff; color: #4338ca; }
        .type-match { background: #fef3c7; color: #b45309; }
        .type-sequence { background: #d1fae5; color: #047857; }
        .type-short_answer { background: #fce7f3; color: #be185d; }
        .question-text {
            font-size: 1.1rem;
            color: #1a1a2e;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        .answers-list { display: flex; flex-direction: column; gap: 10px; }
        .answer-option {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            background: #f8fafc;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .answer-option:hover { border-color: #4f46e5; background: #f0f0ff; }
        .answer-option.correct { border-color: #10b981; background: #d1fae5; }
        .answer-letter {
            width: 28px;
            height: 28px;
            background: #e5e7eb;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 0.85rem;
            color: #4b5563;
        }
        .answer-option.correct .answer-letter { background: #10b981; color: white; }
        .answer-text { flex: 1; color: #374151; }

        /* Match question */
        .match-container { display: flex; flex-direction: column; gap: 12px; }
        .match-pair {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 12px 16px;
            background: #f8fafc;
            border-radius: 12px;
        }
        .match-left {
            flex: 1;
            padding: 10px 14px;
            background: #dbeafe;
            border-radius: 8px;
            color: #1d4ed8;
            font-weight: 500;
        }
        .match-arrow { color: #9ca3af; font-size: 1.2rem; }
        .match-right {
            flex: 1;
            padding: 10px 14px;
            background: #d1fae5;
            border-radius: 8px;
            color: #047857;
            font-weight: 500;
        }

        /* Sequence question */
        .sequence-container { display: flex; flex-direction: column; gap: 10px; }
        .sequence-item {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 14px 16px;
            background: #f8fafc;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
        }
        .sequence-num {
            width: 32px;
            height: 32px;
            background: #10b981;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
        }
        .sequence-text { flex: 1; color: #374151; }

        /* Short answer */
        .short-answer-container {
            padding: 16px;
            background: #f8fafc;
            border-radius: 12px;
        }
        .short-answer-label { font-weight: 500; color: #4b5563; margin-bottom: 10px; }
        .short-answer-input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 1rem;
            margin-bottom: 12px;
        }
        .correct-answers {
            background: #d1fae5;
            padding: 12px 16px;
            border-radius: 8px;
            color: #047857;
        }
        .correct-answers strong { display: block; margin-bottom: 6px; }

        .print-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #1a1a2e;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 1rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .print-btn:hover { background: #2d2d4a; }

        /* Question image */
        .question-image {
            margin: 16px 0;
            text-align: center;
        }
        .question-image img {
            max-width: 100%;
            max-height: 400px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            cursor: pointer;
            transition: transform 0.3s ease;
        }
        .question-image img:hover {
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }
        .question-image img.zoomed {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: 95vw;
            max-height: 95vh;
            z-index: 10000;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }

        @media print {
            body { background: white; padding: 10px; }
            .print-btn { display: none; }
            .question-card { break-inside: avoid; box-shadow: none; border: 1px solid #ddd; }
            .question-image img { max-height: 300px; }
        }
    </style>
</head>
<body>
    <div class="preview-header">
        <div>
            <h1>${escapeHtml(title)}</h1>
            <div class="info">Всего вопросов: ${questions.length}</div>
        </div>
        <div class="preview-badge">Предпросмотр</div>
    </div>

    ${questions.map((q, idx) => generateQuestionPreviewHtml(q, idx + 1)).join('')}

    <button class="print-btn" onclick="window.print()">🖨️ Печать</button>
    <script>
        window.onload = function() {
            if (typeof renderMathInElement === 'function') {
                renderMathInElement(document.body, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\\\(', right: '\\\\)', display: false},
                        {left: '\\\\[', right: '\\\\]', display: true}
                    ],
                    throwOnError: false
                });
            }
        };
    </script>
</body>
</html>`;
}

// Генерация HTML одного вопроса для предпросмотра
function generateQuestionPreviewHtml(q, num) {
    const typeLabels = {
        single: 'Выбор ответа',
        multiple: 'Множественный выбор',
        match: 'Сопоставление',
        sequence: 'Последовательность',
        short_answer: 'Короткий ответ'
    };
    const type = q.type || 'single';

    let answersHtml = '';

    if (type === 'single' || !type) {
        // Один правильный ответ
        answersHtml = `
            <div class="answers-list">
                ${(q.answers || []).map(a => {
                    const answerImage = a.image ? `<img src="${a.image}" style="max-width:200px;max-height:150px;border-radius:6px;margin-top:8px;display:block;">` : '';
                    const answerText = a.text ? escapeHtml(a.text) : '';
                    return `
                    <div class="answer-option ${a.letter === q.correct ? 'correct' : ''}">
                        <span class="answer-letter">${a.letter}</span>
                        <span class="answer-text">${answerText}${answerImage}</span>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    } else if (type === 'multiple') {
        // Множественный выбор - несколько правильных
        const correctArr = Array.isArray(q.correct) ? q.correct : [q.correct];
        answersHtml = `
            <div class="answers-list">
                ${(q.answers || []).map(a => {
                    const answerImage = a.image ? `<img src="${a.image}" style="max-width:200px;max-height:150px;border-radius:6px;margin-top:8px;display:block;">` : '';
                    const answerText = a.text ? escapeHtml(a.text) : '';
                    return `
                    <div class="answer-option ${correctArr.includes(a.letter) ? 'correct' : ''}">
                        <span class="answer-letter">${a.letter}</span>
                        <span class="answer-text">${answerText}${answerImage}</span>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    } else if (type === 'match') {
        // Сопоставление
        answersHtml = `
            <div class="match-container">
                ${(q.pairs || []).map(p => {
                    const leftImg = p.leftImage ? `<img src="${p.leftImage}" style="max-width:80px;max-height:60px;border-radius:4px;margin-right:8px;">` : '';
                    const rightImg = p.rightImage ? `<img src="${p.rightImage}" style="max-width:80px;max-height:60px;border-radius:4px;margin-right:8px;">` : '';
                    return `
                    <div class="match-pair">
                        <div class="match-left">${leftImg}${escapeHtml(p.left || '')}</div>
                        <span class="match-arrow">→</span>
                        <div class="match-right">${rightImg}${escapeHtml(p.right || '')}</div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    } else if (type === 'sequence') {
        // Последовательность - элементы могут быть строками или объектами {text, image}
        answersHtml = `
            <div class="sequence-container">
                ${(q.items || []).map((item, i) => {
                    const itemText = typeof item === 'string' ? item : (item.text || '');
                    const itemImage = typeof item === 'object' && item.image ? `<img src="${item.image}" style="max-width:100px;max-height:80px;border-radius:4px;margin-left:12px;">` : '';
                    return `
                    <div class="sequence-item">
                        <span class="sequence-num">${i + 1}</span>
                        <span class="sequence-text">${escapeHtml(itemText)}</span>
                        ${itemImage}
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    } else if (type === 'short_answer') {
        // Короткий ответ
        const correctArr = Array.isArray(q.correct) ? q.correct : [q.correct];
        answersHtml = `
            <div class="short-answer-container">
                <div class="short-answer-label">Поле для ввода ответа:</div>
                <input type="text" class="short-answer-input" placeholder="Введите ответ..." disabled>
                <div class="correct-answers">
                    <strong>Правильные ответы:</strong>
                    ${correctArr.filter(a => a).map(a => escapeHtml(a)).join(', ')}
                </div>
            </div>
        `;
    }

    // Обработка текста и картинки
    let questionText = q.text || '';
    let questionImage = q.image || null;

    // Если в тексте есть <img - извлекаем картинку оттуда (для старых вопросов)
    if (questionText.includes('<img')) {
        const imgMatch = questionText.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
        if (imgMatch && !questionImage) {
            questionImage = imgMatch[1];
        }
        // Убираем img теги из текста
        questionText = questionText.replace(/<img[^>]*>/gi, '').replace(/<br\s*\/?>/gi, ' ').trim();
    }

    // Очищаем текст от HTML тегов
    const cleanText = new DOMParser().parseFromString(questionText, 'text/html').body.textContent || '';

    // Генерация HTML для картинки (если есть)
    const imageHtml = questionImage ? `
        <div class="question-image">
            <img src="${questionImage}" alt="Изображение к вопросу" onclick="this.classList.toggle('zoomed')">
        </div>
    ` : '';

    return `
        <div class="question-card">
            <div class="question-header">
                <div class="question-number">${num}</div>
                <span class="question-type type-${type}">${typeLabels[type] || 'Выбор ответа'}</span>
            </div>
            <div class="question-text">${escapeHtml(cleanText)}</div>
            ${imageHtml}
            ${answersHtml}
        </div>
    `;
}

async function showExportModal() {
    if (!currentTestForQuestions) return;

    const result = await apiRequest(`/questions?testId=${currentTestForQuestions.id}`);
    const questions = result.success ? result.questions : [];

    if (questions.length === 0) {
        await showError('Нет вопросов для экспорта');
        return;
    }

    const giftContent = exportQuestionsToGIFT(questions);

    // Создаём модальное окно экспорта
    let exportModal = document.getElementById('export-modal');
    if (!exportModal) {
        exportModal = document.createElement('div');
        exportModal.id = 'export-modal';
        exportModal.className = 'modal';
        document.body.appendChild(exportModal);
    }

    exportModal.innerHTML = `
        <div class="modal-content modal-medium">
            <div class="modal-header">
                <h2>Экспорт вопросов (GIFT формат)</h2>
                <button class="btn-close" onclick="hideExportModal()">&times;</button>
            </div>
            <div class="export-info">
                <p>Экспортировано ${questions.length} вопросов</p>
            </div>
            <textarea id="export-content" rows="15" readonly>${giftContent}</textarea>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="copyExportContent()">📋 Копировать</button>
                <button class="btn btn-primary" onclick="downloadExportFile()">💾 Скачать файл</button>
            </div>
        </div>
    `;

    showModal(exportModal);
}

function hideExportModal() {
    hideModal('export-modal');
}

async function copyExportContent() {
    const textarea = document.getElementById('export-content');
    try {
        await navigator.clipboard.writeText(textarea.value);
    } catch (err) {
        // Fallback for older browsers
        textarea.select();
        document.execCommand('copy');
    }
    await showSuccess('Содержимое скопировано в буфер обмена');
}

function downloadExportFile() {
    const content = document.getElementById('export-content').value;
    const testName = currentTestForQuestions?.name || 'questions';
    const filename = `${testName.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_export.gift`;

    // BOM для корректного отображения UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

// ============================================
// СПРАВКА / ИНСТРУКЦИЯ
// ============================================

