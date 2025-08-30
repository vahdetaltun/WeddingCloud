document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const popup = document.getElementById('popup');
  const closePopup = document.getElementById('closePopup');
  const formContainer = document.getElementById('form-container');
  const selectorButtons = document.querySelectorAll('.input-selector button');
  const textInputGroup = document.getElementById('textInputGroup');
  const audioInputGroup = document.getElementById('audioInputGroup');
  const imageInputGroup = document.getElementById('imageInputGroup');
  const videoInputGroup = document.getElementById('videoInputGroup');
  const form = document.getElementById('memoryForm');
  const loader = document.getElementById('loader');
  const statusMessage = document.getElementById('statusMessage');
  const recordButton = document.getElementById('recordButton');
  const stopButton = document.getElementById('stopButton');
  const audioPreview = document.getElementById('audioPreview');
  const audioDataInput = document.getElementById('audioData');
  const imageInput = document.getElementById('imageInput');
  const imagePreview = document.getElementById('imagePreview');
  const videoInput = document.getElementById('videoInput');
  const videoPreview = document.getElementById('videoPreview');
  const submitButton = document.getElementById('submitButton');
  const imageSelectionInfo = document.getElementById('imageSelectionInfo');
  const heartsContainer = document.getElementById('hearts-container');

  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby-WHdbVQYWbKc60SEMbl_Q7v3YpLaz3t9Ao82DbyybbsBKBDXbkPyn5_Wqv9ETmniTKw/exec';
  const API_KEY = '12345ABC';
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const MAX_IMAGE_COUNT = 10; // Maksimum 10 resim
  const MAX_TOTAL_IMAGE_SIZE = 100 * 1024 * 1024; // Toplam 100MB
  const UPLOAD_TIMEOUT = 300000; // 5 dakika (300000 ms)
  const FILE_READ_TIMEOUT = 120000; // 2 dakika (120000 ms)

  let mediaRecorder;
  let audioChunks = [];
  let clientIP = "";

  let base64Images = [];
  let base64Videos = [];
  let totalImageSize = 0;
  let selectedFiles = [];

  // Kalp animasyonu oluştur
  function createHearts() {
    const heartEmojis = ['💖', '💕', '💗', '💓', '💞', '💘'];
    for (let i = 0; i < 15; i++) {
      const heart = document.createElement('div');
      heart.className = 'heart';
      heart.textContent = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];
      heart.style.left = Math.random() * 100 + '%';
      heart.style.animationDelay = Math.random() * 5 + 's';
      heartsContainer.appendChild(heart);
    }
  }
  
  createHearts();

  // IP adresini al
  fetch("https://api64.ipify.org?format=json")
    .then(res => res.json())
    .then(data => { clientIP = data.ip; })
    .catch(() => { clientIP = "Bilinmiyor"; });

  // Toast bildirim fonksiyonu
  function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toastContainer.removeChild(toast), 300);
    }, 5000);
  }

  // Timeout'lu FileReader fonksiyonu
  function readFileWithTimeout(file, timeout = FILE_READ_TIMEOUT) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const timer = setTimeout(() => {
            reader.abort();
            reject(new Error(`Dosya okuma zaman aşımı (${timeout/1000} saniye)`));
        }, timeout);

        reader.onload = () => {
            clearTimeout(timer);
            resolve(reader.result);
        };

        reader.onerror = () => {
            clearTimeout(timer);
            reject(reader.error);
        };

        reader.onabort = () => {
            reject(new Error('Dosya okuma iptal edildi'));
        };

        reader.readAsDataURL(file);
    });
  }

  // Timeout'lu fetch işlemi
  async function fetchWithTimeout(url, options, timeout = UPLOAD_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`İstek zaman aşımı (${timeout/1000} saniye)`);
        }
        throw error;
    }
  }

  // Mikrofon izni kontrolü
  async function checkMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        return false;
    }
  }

  // Android tarayıcı kontrolü
  function isAndroid() {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('android');
  }

  // Popup kapat, form göster
  closePopup.addEventListener('click', function() {
    popup.style.display = 'none';
    formContainer.style.display = 'block';
    showToast("Anı defterimize hoş geldiniz! 💕", "info");
  });

  // İsim doğrulama fonksiyonu
  function isValidName(name) {
    const invalidPattern = /^[.,\-_\s]+$/;
    const validPattern = /^[a-zA-ZçÇğĞıİöÖşŞüÜ\s]{2,}$/;
    return !invalidPattern.test(name) && validPattern.test(name);
  }

  // Tür seçici butonlar
  selectorButtons.forEach(button => {
    button.addEventListener('click', function() {
      selectorButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');

      const type = this.dataset.type;
      textInputGroup.style.display = type === 'text' ? 'block' : 'none';
      audioInputGroup.style.display = type === 'audio' ? 'block' : 'none';
      imageInputGroup.style.display = type === 'image' ? 'block' : 'none';
      videoInputGroup.style.display = type === 'video' ? 'block' : 'none';

      hideStatus();
      
      const typeNames = {
        text: "metin mesajı",
        audio: "ses kaydı",
        image: "fotoğraf",
        video: "video"
      };
      showToast(`${typeNames[type]} paylaşımı seçildi. ✨`, "info");
    });
  });

  // Çoklu resim seçimi ve önizleme
  imageInput.addEventListener('change', async function(e) {
    const files = Array.from(e.target.files);
    base64Images = [];
    selectedFiles = [];
    totalImageSize = 0;
    imagePreview.innerHTML = '';
    imageSelectionInfo.style.display = 'none';

    if (files.length === 0) return;

    if (files.length > MAX_IMAGE_COUNT) {
      showToast(`En fazla ${MAX_IMAGE_COUNT} fotoğraf seçebilirsiniz. ❌`, "error");
      this.value = '';
      return;
    }

    const totalSize = files.reduce((total, file) => total + file.size, 0);
    if (totalSize > MAX_TOTAL_IMAGE_SIZE) {
      showToast("Toplam dosya boyutu 100MB sınırını aşıyor. ❌", "error");
      this.value = '';
      return;
    }

    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      showToast("Bazı dosyalar 100MB sınırından büyük. ❌", "error");
      this.value = '';
      return;
    }

    imageSelectionInfo.style.display = 'block';
    imageSelectionInfo.innerHTML = `📊 ${files.length} fotoğraf seçildi - Toplam: ${formatFileSize(totalSize)}`;

    for (const [index, file] of files.entries()) {
      try {
        const base64Data = await readFileWithTimeout(file);
        base64Images.push(base64Data);
        selectedFiles.push({
          base64: base64Data,
          size: file.size,
          name: file.name
        });
        totalImageSize += file.size;

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.dataset.index = index;
        fileInfo.innerHTML = `
          <div class="file-preview-with-image">
            <img src="${base64Data}" class="file-preview-image" alt="${file.name}">
            <div class="file-details">
              <div class="file-name">${file.name}</div>
              <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
          </div>
          <button type="button" class="remove-file" data-index="${index}">×</button>
        `;
        imagePreview.appendChild(fileInfo);
        
        const removeBtn = fileInfo.querySelector('.remove-file');
        removeBtn.addEventListener('click', function() {
          removeImage(this.dataset.index, file.size);
        });
      } catch (error) {
        showToast(`"${file.name}" yüklenirken hata: ${error.message} ❌`, "error");
      }
    }
    
    if (files.length > 0) {
      showToast(`${files.length} fotoğraf seçildi. 📸`, "success");
    }
  });

  // Resim kaldırma fonksiyonu
  function removeImage(index, size) {
    base64Images.splice(index, 1);
    selectedFiles.splice(index, 1);
    
    const fileElement = document.querySelector(`.file-info[data-index="${index}"]`);
    if (fileElement) {
      fileElement.remove();
    }
    
    const fileElements = document.querySelectorAll('.file-info');
    fileElements.forEach((element, i) => {
      element.dataset.index = i;
      const removeBtn = element.querySelector('.remove-file');
      removeBtn.dataset.index = i;
    });
    
    totalImageSize -= size;
    const remainingImages = imagePreview.querySelectorAll('.file-info').length;
    
    if (remainingImages === 0) {
      imageSelectionInfo.style.display = 'none';
      base64Images = [];
      selectedFiles = [];
    } else {
      imageSelectionInfo.innerHTML = `📊 ${remainingImages} fotoğraf seçildi - Toplam: ${formatFileSize(totalImageSize)}`;
    }
    
    showToast("Fotoğraf kaldırıldı. ❌", "info");
  }

  // Video seçim işlemi
  videoInput.addEventListener('change', function(e) {
    handleVideoSelection(e.target.files[0]);
  });

  function handleVideoSelection(file) {
    base64Videos = [];
    videoPreview.innerHTML = '';

    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      showToast("Video 100MB sınırından büyük. Daha küçük bir video seçin. ❌", "error");
      videoInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
      const base64Data = event.target.result;
      base64Videos.push(base64Data);
      createVideoPreview(base64Data, file);
    };
    reader.onerror = function() {
      showToast("Video okunurken hata oluştu. ❌", "error");
    };
    reader.readAsDataURL(file);
    
    showToast("Video seçildi. 🎬", "success");
  }

  function createVideoPreview(base64Data, file) {
    const videoElement = document.createElement('video');
    videoElement.controls = true;
    videoElement.style.maxWidth = '100%';
    videoElement.style.borderRadius = '8px';
    videoElement.style.marginTop = '15px';
    
    const source = document.createElement('source');
    source.src = base64Data;
    source.type = file.type;
    videoElement.appendChild(source);

    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.innerHTML = `
      <div class="file-preview-with-image">
        <div style="width:60px; height:60px; display:flex; align-items:center; justify-content:center; background:#f0f0f0; border-radius:8px;">
          <span style="font-size:24px;">🎥</span>
        </div>
        <div class="file-details">
          <div class="file-name">${file.name}</div>
          <div class="file-size">${formatFileSize(file.size)}</div>
        </div>
      </div>
      <button type="button" class="remove-file" onclick="removeVideo()">×</button>
    `;
    
    videoPreview.appendChild(fileInfo);
    videoPreview.appendChild(videoElement);
  }

  // Video kaldırma fonksiyonu
  window.removeVideo = function() {
    base64Videos = [];
    videoInput.value = '';
    videoPreview.innerHTML = '';
    showToast("Video kaldırıldı. ❌", "info");
  };

  // Dosya boyutunu formatlama
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // SES KAYDI - ANDROID UYUMLU DÜZELTİLMİŞ VERSİYON
  recordButton.addEventListener('click', async function() {
    try {
      // HTTPS kontrolü (Android için önemli)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        showToast("Ses kaydı için HTTPS bağlantısı gereklidir. 🔒", "warning");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1
        }
      });

      // Android için özel codec ayarları
      let options = { 
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      };

      if (isAndroid()) {
        const androidCodecs = [
          'audio/webm',
          'audio/mp4',
          'audio/wav',
          'audio/ogg',
          'audio/3gpp'
        ];

        for (const codec of androidCodecs) {
          if (MediaRecorder.isTypeSupported(codec)) {
            options.mimeType = codec;
            break;
          }
        }
      }

      mediaRecorder = new MediaRecorder(stream, options);
      audioChunks = [];

      mediaRecorder.ondataavailable = function(e) {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = function() {
        const audioBlob = new Blob(audioChunks, { 
          type: mediaRecorder.mimeType || 'audio/webm'
        });
        
        const audioUrl = URL.createObjectURL(audioBlob);
        audioPreview.src = audioUrl;
        audioPreview.style.display = 'block';

        const reader = new FileReader();
        reader.onloadend = function() {
          audioDataInput.value = reader.result;
        };
        reader.readAsDataURL(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.onerror = function(event) {
        console.error('MediaRecorder error:', event.error);
        showToast("Ses kaydı sırasında hata oluştu. 🎤", "error");
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      recordButton.disabled = true;
      stopButton.style.display = 'inline-block';
      recordButton.classList.add('recording');
      showToast("Ses kaydı başladı... Konuşmaya başlayabilirsiniz! 🎤", "info");

    } catch (err) {
      console.error('Microphone error:', err);
      
      let errorMessage = "Mikrofona erişim izni vermeniz gerekiyor. 🎤";
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = "Mikrofon erişimi engellendi. Lütfen tarayıcı ayarlarından izin verin. 🔒";
      } else if (err.name === 'NotFoundError') {
        errorMessage = "Mikrofon bulunamadı. 🎤";
      } else if (err.name === 'NotReadableError') {
        errorMessage = "Mikrofon başka bir uygulama tarafından kullanılıyor. 📱";
      }
      
      showToast(errorMessage, "error");
      
      if (isAndroid()) {
        setTimeout(() => {
          showToast("Android: Chrome ayarları > Site ayarları > Mikrofon iznini kontrol edin. ⚙️", "info");
        }, 2000);
      }
    }
  });

  // Ses kaydını durdurma
  stopButton.addEventListener('click', function() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
        recordButton.disabled = false;
        stopButton.style.display = 'none';
        recordButton.classList.remove('recording');
        showToast("Ses kaydı tamamlandı. 🎶", "success");
      } catch (error) {
        showToast("Kayıt durdurulurken hata oluştu. 🔴", "error");
      }
    }
  });

  // Form gönderimi
  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const activeType = document.querySelector('.input-selector .active').dataset.type;
    const name = document.getElementById('name').value.trim();
    const message = document.getElementById('message').value.trim();
    const audioData = audioDataInput.value;

    if (!name) { 
      showToast("Lütfen isminizi yazın ki anınızı kime saklayacağımızı bilelim. 😊", "error"); 
      return; 
    }
    
    if (!isValidName(name)) {
      showToast("Lütfen geçerli bir isim girin. ❌", "error");
      return;
    }
    
    if (activeType === 'text' && !message) { 
      showToast("Anı defterimiz için güzel bir mesaj yazmanızı rica ediyoruz. 💌", "error"); 
      return; 
    }
    
    if (activeType === 'audio' && !audioData) { 
      showToast("Lütfen bizim için güzel bir ses kaydı yapın. 🎤", "error"); 
      return; 
    }
    
    if (activeType === 'image' && base64Images.length === 0) { 
      showToast("En az bir fotoğraf seçerek anılarımıza renk katın. 📸", "error"); 
      return; 
    }
    
    if (activeType === 'video' && base64Videos.length === 0) { 
      showToast("Bir video seçerek anılarımızı hareketlendirin. 🎬", "error"); 
      return; 
    }

    const formData = new FormData();
    formData.append('key', API_KEY);
    formData.append('name', name);
    formData.append('type', activeType);
    formData.append('ip', clientIP);

    if (activeType === 'text') formData.append('message', message);
    else if (activeType === 'audio') formData.append('file', audioData);
    else if (activeType === 'image') formData.append('files', JSON.stringify(base64Images));
    else if (activeType === 'video') formData.append('files', JSON.stringify(base64Videos));

    loader.style.display = 'block';
    submitButton.disabled = true;
    hideStatus();

    try {
      const response = await fetchWithTimeout(SCRIPT_URL, { 
        method: 'POST', 
        body: formData 
      }, UPLOAD_TIMEOUT);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();

      if (result.success) {
        showToast("Anınız başarıyla kaydedildi! Bizimle paylaştığınız için teşekkür ederiz. 💖", "success");
        form.reset();
        audioPreview.style.display = 'none';
        imagePreview.innerHTML = '';
        videoPreview.innerHTML = '';
        imageSelectionInfo.style.display = 'none';
        selectorButtons.forEach(btn => btn.classList.remove('active'));
        selectorButtons[0].classList.add('active');
        textInputGroup.style.display = 'block';
        audioInputGroup.style.display = 'none';
        imageInputGroup.style.display = 'none';
        videoInputGroup.style.display = 'none';

        base64Images = [];
        base64Videos = [];
        selectedFiles = [];
        totalImageSize = 0;
        audioDataInput.value = "";
      } else {
        showToast("Bir şeyler ters gitti. Lütfen daha sonra tekrar deneyin. 😔", "error");
      }
    } catch (error) {
      if (error.message.includes('zaman aşımı')) {
        showToast("İşlem çok uzun sürdü, lütfen daha sonra tekrar deneyin. ⏰", "error");
      } else {
        showToast("Bağlantı hatası oluştu. Lütfen internet bağlantınızı kontrol edin. 🌐", "error");
      }
      console.error('Error:', error);
    } finally {
      loader.style.display = 'none';
      submitButton.disabled = false;
    }
  });

  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = type;
    statusMessage.style.display = 'block';
    setTimeout(hideStatus, 5000);
  }

  function hideStatus() {
    statusMessage.style.display = 'none';
    statusMessage.textContent = '';
  }

  // Sayfa yüklendiğinde mikrofon iznini kontrol et
  setTimeout(async () => {
    const hasPermission = await checkMicrophonePermission();
    if (!hasPermission && isAndroid()) {
      showToast("Ses kaydı için mikrofon erişimine izin vermeniz gerekiyor. 🎤", "info");
    }
  }, 2000);
});