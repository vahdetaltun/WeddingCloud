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

  // Yeni deployment URL'sini buraya yapıştır (Apps Script'ten al)
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzAHI6FB6skawGtkKk6KUIbuRNjZU0zbSY9X9Em86I8zu7XOw2z2MW85zb97CQpR9CT6w/exec';
  const API_KEY = '12345ABC';

  let mediaRecorder;
  let audioChunks = [];
  let clientIP = "";

  // Base64 array'leri yerine, orijinal dosya objelerini tut (bellek tasarrufu için)
  let imageFiles = [];  // Resim dosyaları
  let videoFiles = [];  // Video dosyaları

  // Boyut limitleri (byte cinsinden)
  const MAX_FILE_SIZE = 25 * 1024 * 1024;  // 25MB per dosya
  const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB total

  // IP adresini al
  fetch("https://api64.ipify.org?format=json")
    .then(res => res.json())
    .then(data => { clientIP = data.ip; })
    .catch(() => { clientIP = "Bilinmiyor"; });

  // Popup kapat, form göster
  closePopup.addEventListener('click', function() {
    popup.style.display = 'none';
    formContainer.style.display = 'block';
  });

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
    });
  });

  // Çoklu resim seçimi ve önizleme (boyut kontrolü ekle)
  imageInput.addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    imageFiles = [];  // Temizle
    let totalSize = 0;
    imagePreview.innerHTML = '';

    for (let file of files) {
      if (file.size > MAX_FILE_SIZE) {
        showStatus(`Resim "${file.name}" çok büyük (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_FILE_SIZE / 1024 / 1024}MB olmalı.`, "error");
        return;
      }
      totalSize += file.size;
      if (totalSize > MAX_TOTAL_SIZE) {
        showStatus("Toplam resim boyutu çok büyük. Max " + (MAX_TOTAL_SIZE / 1024 / 1024) + "MB olmalı.", "error");
        return;
      }

      imageFiles.push(file);

      // Önizleme için küçük base64 (sadece thumbnail, tam dosya değil)
      const reader = new FileReader();
      reader.onload = function(event) {
        const img = document.createElement('img');
        img.src = event.target.result;
        img.style.maxWidth = '100px';
        img.style.maxHeight = '100px';
        img.style.borderRadius = '5px';
        img.style.objectFit = 'cover';
        img.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
        imagePreview.appendChild(img);
      };
      reader.readAsDataURL(file);  // Thumbnail için, bellek sorunu yok
    }
    showStatus(`${files.length} resim seçildi. Toplam: ${(totalSize / 1024 / 1024).toFixed(1)}MB`, "success");
  });

  // Çoklu video seçimi ve önizleme (boyut kontrolü ekle, base64 YOK)
  videoInput.addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    videoFiles = [];  // Temizle
    let totalSize = 0;
    videoPreview.innerHTML = '';

    for (let file of files) {
      if (file.size > MAX_FILE_SIZE) {
        showStatus(`Video "${file.name}" çok büyük (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_FILE_SIZE / 1024 / 1024}MB olmalı.`, "error");
        return;
      }
      totalSize += file.size;
      if (totalSize > MAX_TOTAL_SIZE) {
        showStatus("Toplam video boyutu çok büyük. Max " + (MAX_TOTAL_SIZE / 1024 / 1024) + "MB olmalı.", "error");
        return;
      }

      videoFiles.push(file);

      // Önizleme için video elementi oluştur (base64 olmadan, URL.createObjectURL ile)
      const video = document.createElement('video');
      video.controls = true;
      video.style.maxWidth = '150px';
      video.style.maxHeight = '100px';
      video.style.borderRadius = '5px';
      video.src = URL.createObjectURL(file);  // Bellek dostu, revoke et (aşağıda)
      videoPreview.appendChild(video);
    }
    showStatus(`${files.length} video seçildi. Toplam: ${(totalSize / 1024 / 1024).toFixed(1)}MB`, "success");

    // Önizleme URL'lerini temizle (memory leak önle)
    setTimeout(() => {
      videoPreview.querySelectorAll('video').forEach(v => URL.revokeObjectURL(v.src));
    }, 10000);  // 10 sn sonra temizle
  });

  // Ses kaydı başlatma (değişmedi)
  recordButton.addEventListener('click', async function() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let options = { mimeType: "audio/webm" };
      if (MediaRecorder.isTypeSupported("audio/mp4")) options = { mimeType: "audio/mp4" };
      else if (MediaRecorder.isTypeSupported("audio/wav")) options = { mimeType: "audio/wav" };
      else if (MediaRecorder.isTypeSupported("audio/3gpp")) options = { mimeType: "audio/3gpp" };

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
          audioDataInput.value = reader.result;
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      recordButton.disabled = true;
      stopButton.style.display = 'inline-block';
      showStatus("Kayıt başladı...", "success");
    } catch (err) {
      showStatus("Mikrofon erişimi reddedildi: " + err.message, "error");
    }
  });

  // Ses kaydını durdurma (değişmedi)
  stopButton.addEventListener('click', function() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      recordButton.disabled = false;
      stopButton.style.display = 'none';
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      showStatus("Kayıt tamamlandı", "success");
    }
  });

  // Yardımcı fonksiyon: Progress ile XMLHttpRequest gönder
  function sendWithProgress(formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', SCRIPT_URL, true);

      // CORS için gerekli başlıkları ekle
      xhr.setRequestHeader('Accept', 'application/json');

      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } catch (err) {
            reject(new Error(`JSON parse error: ${xhr.responseText}`));
          }
        } else {
          reject(new Error(`HTTP error! status: ${xhr.status} - ${xhr.statusText || 'Unknown server error'}`));
        }
      };

      xhr.onerror = function() {
        reject(new Error('CORS or network error: Failed to connect to server or request was aborted. Check SCRIPT_URL and deployment settings.'));
      };

      xhr.onabort = function() {
        reject(new Error('Request aborted by client'));
      };

      xhr.send(formData);
    });
  }

  // Yardımcı fonksiyon: Tek dosya veya array'i yükle (progress ile)
  async function uploadFiles(files, type, name) {
    let successCount = 0;
    const totalFiles = files.length;
    let totalUploadedBytes = 0;
    let totalBytes = 0;

    // Toplam boyutu hesapla
    files.forEach(file => totalBytes += file.size);

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      let currentFileUploaded = 0;
      let isComplete = false;

      // Progress güncelleme interval'i (sürekli bildirim)
      const progressInterval = setInterval(() => {
        if (isComplete) {
          clearInterval(progressInterval);
          return;
        }
        const currentPercent = Math.round((currentFileUploaded / file.size) * 100);
        const overallPercent = Math.round((totalUploadedBytes / totalBytes) * 100);
        updateStatus(`${type.charAt(0).toUpperCase() + type.slice(1)} yükleniyor: ${i + 1}/${totalFiles} (%${currentPercent}) - Toplam: %${overallPercent}`, "success");
      }, 500);  // Her 500ms güncelle

      // Base64'e çevir
      const reader = new FileReader();
      await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('FileReader error: Failed to read file'));
        reader.readAsDataURL(file);
      });

      const base64Data = reader.result;
      const formData = new FormData();
      formData.append('key', API_KEY);
      formData.append('name', name);
      formData.append('type', type);
      formData.append('ip', clientIP);
      formData.append('files', JSON.stringify([base64Data]));

      try {
        const result = await sendWithProgress(formData, (percent) => {
          currentFileUploaded = (percent / 100) * file.size;
          totalUploadedBytes = totalUploadedBytes + currentFileUploaded - (previousUploaded || 0);
          previousUploaded = currentFileUploaded;
        });

        if (!result.success) throw new Error(result.message || "Bilinmeyen sunucu hatası");

        successCount++;
        totalUploadedBytes += file.size;
        isComplete = true;
        clearInterval(progressInterval);
        updateStatus(`${type.charAt(0).toUpperCase() + type.slice(1)} ${i + 1}/${totalFiles} tamamlandı! (%100) - Toplam: %${Math.round((totalUploadedBytes / totalBytes) * 100)}`, "success");
      } catch (error) {
        isComplete = true;
        clearInterval(progressInterval);
        console.error(`Hata (Dosya ${i + 1}/${totalFiles}):`, error.message, error);
        updateStatus(`${type.charAt(0).toUpperCase() + type.slice(1)} ${i + 1}/${totalFiles} hatası: ${error.message}`, "error");
        return false;
      }

      // Memory temizle
      delete reader.result;
    }

    return successCount === totalFiles;
  }

  // Form gönderimi
  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const activeType = document.querySelector('.input-selector .active').dataset.type;
    const name = document.getElementById('name').value.trim();
    const message = document.getElementById('message').value.trim();
    const audioData = audioDataInput.value;

    if (!name) { showStatus("Lütfen isminizi girin", "error"); return; }
    if (activeType === 'text' && !message) { showStatus("Lütfen bir mesaj yazın", "error"); return; }
    if (activeType === 'audio' && !audioData) { showStatus("Lütfen bir ses kaydı yapın", "error"); return; }
    if (activeType === 'image' && imageFiles.length === 0) { showStatus("Lütfen en az bir resim seçin", "error"); return; }
    if (activeType === 'video' && videoFiles.length === 0) { showStatus("Lütfen en az bir video seçin", "error"); return; }

    loader.style.display = 'block';
    submitButton.disabled = true;
    hideStatus();

    let success = false;

    try {
      if (activeType === 'text') {
        const formData = new FormData();
        formData.append('key', API_KEY);
        formData.append('name', name);
        formData.append('type', activeType);
        formData.append('ip', clientIP);
        formData.append('message', message);

        const response = await fetch(SCRIPT_URL, { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} - ${response.statusText || 'Unknown server error'}`);
        const result = await response.json();
        success = result.success;
        if (success) {
          showStatus(result.message || "Başarıyla gönderildi!", "success");
        } else {
          console.error('Text upload error:', result.message);
          showStatus(result.message || "Metin gönderimi başarısız oldu", "error");
        }
      } else if (activeType === 'audio') {
        const formData = new FormData();
        formData.append('key', API_KEY);
        formData.append('name', name);
        formData.append('type', activeType);
        formData.append('ip', clientIP);
        formData.append('file', audioData);

        const response = await fetch(SCRIPT_URL, { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} - ${response.statusText || 'Unknown server error'}`);
        const result = await response.json();
        success = result.success;
        if (success) {
          showStatus(result.message || "Başarıyla gönderildi!", "success");
        } else {
          console.error('Audio upload error:', result.message);
          showStatus(result.message || "Ses gönderimi başarısız oldu", "error");
        }
      } else if (activeType === 'image' || activeType === 'video') {
        const files = activeType === 'image' ? imageFiles : videoFiles;
        updateStatus(`${activeType === 'image' ? 'Resim' : 'Video'} yükleme başlıyor...`, "success");
        success = await uploadFiles(files, activeType, name);
        if (success) {
          showStatus(`${activeType === 'image' ? 'Resimleriniz' : 'Videolarınız'} başarıyla yüklenmiştir! 🎉`, "success");
        }
      }

      if (success) {
        // Reset
        form.reset();
        audioPreview.style.display = 'none';
        imagePreview.innerHTML = '';
        videoPreview.innerHTML = '';
        imageFiles = [];
        videoFiles = [];
        selectorButtons.forEach(btn => btn.classList.remove('active'));
        selectorButtons[0].classList.add('active');
        textInputGroup.style.display = 'block';
        audioInputGroup.style.display = 'none';
        imageInputGroup.style.display = 'none';
        videoInputGroup.style.display = 'none';
        audioDataInput.value = "";
      } else {
        showStatus("Gönderim başarısız oldu: Lütfen hata detaylarını kontrol edin", "error");
      }
    } catch (error) {
      console.error('General error:', error.message, error);
      showStatus("Hata oluştu: " + error.message, "error");
    } finally {
      loader.style.display = 'none';
      submitButton.disabled = false;
    }
  });

  // Progress için özel status güncelleme (timeout yok, kalıcı)
  function updateStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = type;
    statusMessage.style.display = 'block';
    setTimeout(() => {
      statusMessage.style.opacity = '1';
      statusMessage.style.transform = 'translateY(0)';
    }, 10);
    // Timeout yok - yükleme bitene kadar kal
  }

  // Eski showStatus (başarı/hata için, timeout'lu)
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = type;
    statusMessage.style.display = 'block';
    setTimeout(() => {
      statusMessage.style.opacity = '1';
      statusMessage.style.transform = 'translateY(0)';
    }, 10);
    const timeoutDuration = type === 'success' ? 7000 : 5000;
    setTimeout(hideStatus, timeoutDuration);
  }

  function hideStatus() {
    statusMessage.style.display = 'none';
    statusMessage.style.opacity = '0';
    statusMessage.style.transform = 'translateY(10px)';
    statusMessage.textContent = '';
  }
});