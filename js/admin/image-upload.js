// ============================================
// ЗАГРУЗКА ИЗОБРАЖЕНИЙ
// ============================================

// currentQuestionImage определена в state.js

function createImageUploadArea(existingImageUrl = null) {
    currentQuestionImage = existingImageUrl;

    const html = `
        <div class="form-group">
            <label>Изображение к вопросу (необязательно)</label>
            <div class="image-upload-area ${existingImageUrl ? 'has-image' : ''}" id="image-upload-area">
                <input type="file" class="image-upload-input" id="question-image-input" accept="image/*">
                ${existingImageUrl ? `
                    <div class="image-preview-container">
                        <img src="${existingImageUrl}" class="image-preview" id="image-preview">
                        <div class="image-preview-actions">
                            <button type="button" class="btn-remove" onclick="removeQuestionImage()" title="Удалить">✕</button>
                        </div>
                    </div>
                ` : `
                    <div class="image-upload-placeholder" id="upload-placeholder">
                        <span class="upload-icon">🖼️</span>
                        <p>Перетащите изображение сюда или нажмите для выбора</p>
                        <p class="hint">PNG, JPG, GIF до 5 МБ</p>
                    </div>
                `}
            </div>
        </div>
    `;
    return html;
}

function initImageUpload() {
    const uploadArea = document.getElementById('image-upload-area');
    const fileInput = document.getElementById('question-image-input');

    if (!uploadArea || !fileInput) return;

    // Клик для выбора файла
    uploadArea.addEventListener('click', (e) => {
        if (e.target.closest('.image-preview-actions')) return;
        fileInput.click();
    });

    // Выбор файла
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleImageFile(file);
    });

    // Drag & drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageFile(file);
        }
    });
}

async function handleImageFile(file) {
    // Проверка размера (5 МБ)
    if (file.size > 5 * 1024 * 1024) {
        await showError('Файл слишком большой. Максимум 5 МБ');
        return;
    }

    const uploadArea = document.getElementById('image-upload-area');

    // Показываем загрузку
    uploadArea.innerHTML = `
        <div class="image-loading">
            <div class="spinner"></div>
            <p>Загрузка изображения...</p>
        </div>
    `;

    try {
        // Конвертируем в base64
        const base64 = await fileToBase64(file);
        currentQuestionImage = base64;

        // Показываем превью
        uploadArea.classList.add('has-image');
        uploadArea.innerHTML = `
            <input type="file" class="image-upload-input" id="question-image-input" accept="image/*">
            <div class="image-preview-container">
                <img src="${base64}" class="image-preview" id="image-preview">
                <div class="image-preview-actions">
                    <button type="button" class="btn-remove" onclick="removeQuestionImage()" title="Удалить">✕</button>
                </div>
            </div>
        `;

        // Переинициализируем события
        initImageUpload();
    } catch (error) {
        await showError('Ошибка загрузки изображения');
        uploadArea.innerHTML = `
            <input type="file" class="image-upload-input" id="question-image-input" accept="image/*">
            <div class="image-upload-placeholder" id="upload-placeholder">
                <span class="upload-icon">🖼️</span>
                <p>Перетащите изображение сюда или нажмите для выбора</p>
                <p class="hint">PNG, JPG, GIF до 5 МБ</p>
            </div>
        `;
        initImageUpload();
    }
}

function removeQuestionImage() {
    currentQuestionImage = null;
    const uploadArea = document.getElementById('image-upload-area');
    if (uploadArea) {
        uploadArea.classList.remove('has-image');
        uploadArea.innerHTML = `
            <input type="file" class="image-upload-input" id="question-image-input" accept="image/*">
            <div class="image-upload-placeholder" id="upload-placeholder">
                <span class="upload-icon">🖼️</span>
                <p>Перетащите изображение сюда или нажмите для выбора</p>
                <p class="hint">PNG, JPG, GIF до 5 МБ</p>
            </div>
        `;
        initImageUpload();
    }
}
