const popup = document.getElementById('popup');
const formContainer = document.getElementById('form-container');
const closePopupBtn = document.getElementById('closePopup');
let popupShown = false;  // Tekrar açılmayı önlemek için

// Popup gösterimi (her sayfa yenilendiğinde açılır)
function showPopup() {
    if (popupShown) return; // Zaten gösterildiyse çık
    popupShown = true;

    const heartsContainer = document.getElementById('hearts-container');

    // Kalpleri oluştur (her sayfa yenilenmesinde yenilensin)
    heartsContainer.innerHTML = '';  // Önce eski kalpleri temizle
    for (let i = 0; i < 100; i++) {
        const heart = document.createElement('div');
        heart.innerHTML = '❤';
        heart.classList.add('heart');
        heart.style.left = Math.random() * 100 + 'vw';
        heart.style.top = Math.random() * 100 + 'vh';
        heart.style.fontSize = (Math.random() * 20 + 10) + 'px';
        heart.style.animationDelay = Math.random() * 5 + 's';
        heartsContainer.appendChild(heart);
    }

    popup.style.display = 'block';
    formContainer.style.display = 'none';

    // 3 saniye sonra popup otomatik kapanır (eğer kullanıcı kapatmadıysa)
    if (!sessionStorage.getItem('popupClosed')) {
        setTimeout(() => {
            popup.style.display = 'none';
            formContainer.style.display = 'block';
            setTimeout(() => {
                formContainer.style.opacity = '1';
            }, 10);
        }, 3000);
    }
}

// Popup kapatma butonu
closePopupBtn.addEventListener('click', () => {
    popup.style.display = 'none';
    formContainer.style.display = 'block';
    formContainer.style.opacity = '1';

    // Popup kapatıldı olarak işaretle
    sessionStorage.setItem('popupClosed', 'true');
});

// Sayfa yüklendiğinde popup göster
window.addEventListener('DOMContentLoaded', () => {
    if (!sessionStorage.getItem('popupClosed')) {
        showPopup();
    } else {
        popup.style.display = 'none';
        formContainer.style.display = 'block';
        formContainer.style.opacity = '1';
    }
});
