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

  let mediaRecorder;
  let audioChunks = [];
  let clientIP = "";

  let base64Images = [];
  let base64Videos = [];
  let totalImageSize = 0;
  let selectedFiles = []; // Seçilen dosyaları takip etmek için

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
    
    // Toast'ı göster
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Toast'ı kaldır
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toastContainer.removeChild(toast), 300);
    }, 5000);
  }

  // Popup kapat, form göster
  closePopup.addEventListener('click', function() {
    popup.style.display = 'none';
    formContainer.style.display = 'block';
    showToast("Anı defterimize hoş geldiniz! 💕", "info");
  });

  // İsim doğrulama fonksiyonu
  function isValidName(name) {
    // Sadece nokta, virgül, tire gibi karakterlerden oluşan isimleri engelle
    const invalidPattern = /^[.,\-_\s]+$/;
    // En az 2 karakter ve geçerli harfler/kelimeler içermeli
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
      
      // Tür değiştiğinde bildirim göster
      const typeNames = {
        text: "Metin mesajı",
        audio: "Ses kaydı",
        image: "Fotoğraf",
        video: "Video"
      };
      showToast(`${typeNames[type]} paylaşımı seçildi. ✨`, "info");
    });
  });

  // Çoklu resim seçimi ve önizleme
  imageInput.addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    base64Images = [];
    selectedFiles = [];
    totalImageSize = 0;
    imagePreview.innerHTML = '';
    imageSelectionInfo.style.display = 'none';

    if (files.length === 0) return;

    // Dosya sayısı kontrolü
    if (files.length > MAX_IMAGE_COUNT) {
      showToast(`En fazla ${MAX_IMAGE_COUNT} fotoğraf seçebilirsiniz. ❌`, "error");
      this.value = '';
      return;
    }

    // Toplam boyut kontrolü
    const totalSize = files.reduce((total, file) => total + file.size, 0);
    if (totalSize > MAX_TOTAL_IMAGE_SIZE) {
      showToast("Toplam dosya boyutu 100MB sınırını aşıyor. ❌", "error");
      this.value = '';
      return;
    }

    // Dosya boyutu kontrolü
    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      showToast("Bazı dosyalar 100MB sınırından büyük. ❌", "error");
      this.value = '';
      return;
    }

    // Seçim bilgisini göster
    imageSelectionInfo.style.display = 'block';
    imageSelectionInfo.innerHTML = `📊 ${files.length} fotoğraf seçildi - Toplam: ${formatFileSize(totalSize)}`;

    // Dosyaları işle
    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = function(event) {
        const base64Data = event.target.result;
        base64Images.push(base64Data);
        selectedFiles.push({
          base64: base64Data,
          size: file.size,
          name: file.name
        });
        totalImageSize += file.size;

        // Dosya bilgisi ve önizleme göster
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
        
        // Kaldırma butonuna olay dinleyici ekle
        const removeBtn = fileInfo.querySelector('.remove-file');
        removeBtn.addEventListener('click', function() {
          removeImage(this.dataset.index, file.size);
        });
      };
      reader.readAsDataURL(file);
    });
    
    if (files.length > 0) {
      showToast(`${files.length} fotoğraf seçildi. 📸`, "success");
    }
  });

  // Resim kaldırma fonksiyonu
  function removeImage(index, size) {
    // Dizilerden ilgili öğeyi kaldır
    base64Images.splice(index, 1);
    selectedFiles.splice(index, 1);
    
    // DOM'dan kaldır
    const fileElement = document.querySelector(`.file-info[data-index="${index}"]`);
    if (fileElement) {
      fileElement.remove();
    }
    
    // Tüm dosya elementlerinin index'lerini güncelle
    const fileElements = document.querySelectorAll('.file-info');
    fileElements.forEach((element, i) => {
      element.dataset.index = i;
      const removeBtn = element.querySelector('.remove-file');
      removeBtn.dataset.index = i;
    });
    
    // Toplam boyutu güncelle
    totalImageSize -= size;
    
    // Seçili dosya sayısını güncelle
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

  // Video seçim işlemi - DÜZELTİLMİŞ VERSİYON
  videoInput.addEventListener('change', function(e) {
    handleVideoSelection(e.target.files[0]);
  });

  // Video seçim işlemini fonksiyona ayır
  function handleVideoSelection(file) {
    base64Videos = []; // Her seferinde array'ı temizle
    videoPreview.innerHTML = '';

    if (!file) return;

    // Dosya boyutu kontrolü
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
    reader.readAsDataURL(file);
    
    showToast("Video seçildi. 🎬", "success");
  }

  // Video önizleme oluştur
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

  // Video kaldırma fonksiyonu - YENİ EKLENDİ
  window.removeVideo = function() {
    base64Videos = []; // Array'ı temizle
    videoInput.value = ''; // Input'u sıfırla
    videoPreview.innerHTML = ''; // Önizlemeyi temizle
    showToast("Video kaldırıldı. ❌", "info");
  };

  // Dosya boyutunu formatlama
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // Ses kaydı başlatma
  recordButton.addEventListener('click', async function() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Tarayıcıya göre uygun format seç
      let options = { mimeType: "audio/webm" }; // varsayılan
      if (MediaRecorder.isTypeSupported("audio/mp4")) options = { mimeType: "audio/mp4" }; // Safari / iOS
      else if (MediaRecorder.isTypeSupported("audio/wav")) options = { mimeType: "audio/wav" }; // diğer
      else if (MediaRecorder.isTypeSupported("audio/3gpp")) options = { mimeType: "audio/3gpp" }; // Android eski

      mediaRecorder = new MediaRecorder(stream, options);
      audioChunks = [];

      mediaRecorder.ondataavailable = function(e) {
        audioChunks.push(e.data);
      };

      mediaRecorder.onstop = function() {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        audioPreview.src = audioUrl;
        audioPreview.style.display = 'block';

        const reader = new FileReader();
        reader.onloadend = function() {
          audioDataInput.value = reader.result; // Base64 olarak sakla
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      recordButton.disabled = true;
      stopButton.style.display = 'inline-block';
      showToast("Ses kaydı başladı... 🎤", "info");
    } catch (err) {
      showToast("Mikrofona erişim izni vermeniz gerekiyor. 🎤", "error");
    }
  });

  // Ses kaydını durdurma
  stopButton.addEventListener('click', function() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      recordButton.disabled = false;
      stopButton.style.display = 'none';
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      showToast("Ses kaydı tamamlandı. 🎶", "success");
    }
  });

  // Form gönderimi
  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const activeType = document.querySelector('.input-selector .active').dataset.type;
    const name = document.getElementById('name').value.trim();
    const message = document.getElementById('message').value.trim();
    const audioData = audioDataInput.value;

    // İsim doğrulama
    if (!name) { 
      showToast("Lütfen isminizi yazın ki anınızı kime saklayacağımızı bilelim. 😊", "error"); 
      return; 
    }
    
    if (!isValidName(name)) {
      showToast("Lütfen geçerli bir isim girin. Sadece özel karakterler içeren isimler kabul edilemez. ❌", "error");
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
      const response = await fetch(SCRIPT_URL, { method: 'POST', body: formData });
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
      showToast("Bağlantı hatası oluştu. Lütfen internet bağlantınızı kontrol edin. 🌐", "error");
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
});