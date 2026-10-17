# Görevlerim

Kurulum gerektirmeyen, tamamen tarayıcıda çalışan görev takip uygulaması.
Saf HTML + CSS + JavaScript. Hiçbir bağımlılık, build adımı ya da veritabanı yok —
veriler tarayıcının `localStorage`'ında tutulur.

## Çalıştırma

Proje klasöründe bir terminal açıp:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File server.ps1
```

Sonra tarayıcıdan **http://localhost:5173/** adresini aç.

> `server.ps1` sadece statik dosya sunan küçük bir PowerShell sunucusudur
> (Node.js / Python kurulu olmadığı için eklendi). Farklı port için:
> `... -File server.ps1 -Port 8080`
>
> `index.html` dosyasını doğrudan çift tıklayarak da açabilirsin, ancak
> `http://localhost` kullanmak `localStorage` ve ileride eklenecek tarayıcı
> API'leri için daha güvenli bir zemin.

## Dosyalar

| Dosya | Açıklama |
| --- | --- |
| `index.html` | Sayfa iskeleti ve tüm arayüz elemanları |
| `styles.css` | Tema değişkenleri, açık/koyu tema, duyarlı yerleşim |
| `app.js` | Durum yönetimi, filtreleme, sürükle-bırak, arşiv, kalıcı kayıt |
| `xlsx.js` | Bağımlılıksız `.xlsx` üretici (ZIP + XML, kütüphane yok) |
| `server.ps1` | Bağımlılıksız yerel statik sunucu |

## Özellikler

- **Görev ekleme**: başlık, kategori, öncelik ve isteğe bağlı tarih
- **Kategoriler**: İş, Kişisel, Alışveriş, Sağlık, Öğrenme, Diğer
- **Öncelik**: Düşük / Orta / Yüksek (kartın sol kenarında renkli şerit)
- **Filtreler**: Tümü / Aktif / Tamamlanan + kategori çipleri
- **Arama**: Türkçe karakterlere duyarlı (`İ`, `ı`, `ş` vb. doğru eşleşir)
- **Satır içi düzenleme**: başlığa veya kalem ikonuna tıkla, `Enter` ile kaydet, `Esc` ile vazgeç
- **Sürükle-bırak sıralama**: sol taraftaki tutamaktan tutup taşı
- **Silme + geri alma**: silinen görev 7 saniye boyunca "Geri al" ile kurtarılabilir
- **Arşiv**: "Tamamlananları arşivle" görevleri silmez, arşive taşır; arşivden tek tek veya toplu geri yüklenebilir
- **Excel'e aktarma**: arşivi ya da tüm görevleri gerçek `.xlsx` olarak indirir
- **İlerleme çubuğu** ve tamamlanma yüzdesi
- **Koyu / açık tema**: buton veya `D` tuşu, tercih hatırlanır
- **Klavye kısayolları**: `N` yeni görev, `D` tema, `Esc` pencereyi/aramayı kapat

## Arşiv ve Excel çıktısı

- "Tamamlananları arşivle" butonu, tamamlanmış görevleri listeden çıkarıp arşive taşır.
  Görev silinmez; tamamlanma tarihi kaydedilir.
- Alttaki **Arşiv** butonu geçmişi açar. Oradan:
  - tek tek **Geri yükle**
  - **Tümünü geri yükle**
  - **Excel'e aktar** (yalnızca arşiv)
  - **Tüm görevleri aktar** (aktif + tamamlanan + arşiv, "Durum" sütunu ile)
  - **Arşivi temizle** (iki adımlı onay, kalıcı silme)
- Excel dosyası şu sütunları içerir: Görev, Kategori, Öncelik, Bitiş Tarihi,
  Tamamlanma Tarihi ve (tüm görevlerde) Durum. Tarihler gerçek Excel tarihi
  olarak yazılır (`gg.aa.yyyy` biçiminde), böylece sıralama/filtreleme çalışır.
- Dosya adı: `gorevler-arsiv-YYYY-AA-GG.xlsx` veya `gorevler-tumu-YYYY-AA-GG.xlsx`.

## Veri saklama

`localStorage` anahtarları:

- `gorevler.v1` → `{ todos: [...], archive: [...] }`
- `gorevler.theme` → `light` / `dark`

Sıfırlamak için tarayıcı konsolunda:

```js
localStorage.removeItem('gorevler.v1'); location.reload();
```

## Sonraki adımlar (fikirler)

- Arşivde arama/filtre ve tarih aralığına göre Excel çıktısı
- Bitiş tarihi yaklaşanlar için hatırlatma / bildirim
- Alt görevler ve notlar
- Etiketler ve çoklu kategori
- JSON içe/dışa aktarma
- Çoklu cihaz senkronizasyonu için küçük bir backend
