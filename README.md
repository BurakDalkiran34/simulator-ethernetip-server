# Ethernet/IP Server Simulator

Node.js ile geliştirilmiş Ethernet/IP protokolüne uygun bir server implementasyonu.

## Özellikler

- ✅ Ethernet/IP Encapsulation protokolü desteği
- ✅ TCP Server (Port 44818) - Explicit Messaging
- ✅ UDP Server (Port 2222) - Implicit Messaging
- ✅ Session yönetimi
- ✅ CIP (Common Industrial Protocol) mesaj işleme
- ✅ Temel Ethernet/IP komutları:
  - Register Session
  - Unregister Session
  - Send RR Data
  - List Services
  - List Identity
- ✅ 100 adet rastgele değişken (tag) desteği
- ✅ Her okumada değerlerin otomatik güncellenmesi
- ✅ Tag okuma servisleri (Read Tag, Get Attribute Single)

## Kurulum

```bash
npm install
```

## Kullanım

### Temel Kullanım

```bash
npm start
```

Veya geliştirme modunda (otomatik yeniden başlatma):

```bash
npm run dev
```

### Ortam Değişkenleri

- `TCP_PORT`: TCP server portu (varsayılan: 44818)
- `UDP_PORT`: UDP server portu (varsayılan: 2222)
- `HOST`: Bind adresi (varsayılan: 0.0.0.0)
- `DEVICE_SLOT_NUMBER`: Cihaz slot numarası (varsayılan: 0)
- `VENDOR_ID`: Vendor ID (hex, varsayılan: 0x0000)
- `DEVICE_TYPE`: Device type (hex, varsayılan: 0x0000)
- `PRODUCT_CODE`: Product code (hex, varsayılan: 0x00000000)
- `PRODUCT_NAME`: Product name (varsayılan: "EtherNet/IP Simulator")
- `DEBUG`: Debug log seviyesi (örn: `ethernetip:*`)

Örnek:

```bash
TCP_PORT=44818 UDP_PORT=2222 DEBUG=ethernetip:* npm start
```

**Device Slot Number Hakkında:**
- **Slot Number**: Ethernet/IP client'larında "device slot number" olarak görünen parametre
- Standalone cihazlar için genellikle **0** veya **1** kullanılır
- Modüler PLC sistemlerinde gerçek slot numarasını belirtir
- Client bağlantılarında `<IP>,1,<slot_number>` formatında kullanılır
- Örnek: `192.168.1.100,1,0` (IP: 192.168.1.100, Backplane: 1, Slot: 0)

### Programatik Kullanım

```javascript
import EthernetIPServer from './src/index.js';

const server = new EthernetIPServer({
  tcpPort: 44818,
  udpPort: 2222,
  host: '0.0.0.0',
  deviceSlotNumber: 0,        // Device slot number (default: 0)
  vendorId: 0x0000,            // Vendor ID (default: 0x0000)
  deviceType: 0x0000,          // Device type (default: 0x0000)
  productCode: 0x00000000,     // Product code (default: 0x00000000)
  productName: 'EtherNet/IP Simulator' // Product name
});

await server.start();

// Server'ı durdurmak için
await server.stop();
```

## Proje Yapısı

```
src/
├── encapsulation/
│   └── EncapsulationPacket.js    # Ethernet/IP encapsulation paket yapısı
├── cip/
│   ├── CIPMessage.js             # CIP mesaj yapısı
│   └── CIPPath.js                # CIP path parsing
├── tags/
│   └── TagManager.js             # Tag yönetimi (100 rastgele tag)
├── server/
│   ├── TCPServer.js              # TCP server (explicit messaging)
│   ├── UDPServer.js              # UDP server (implicit messaging)
│   └── SessionManager.js         # Session yönetimi
└── index.js                      # Ana giriş noktası
```

## Ethernet/IP Protokolü

Ethernet/IP, endüstriyel otomasyon için kullanılan bir protokoldür ve Common Industrial Protocol (CIP) üzerine kuruludur.

### Portlar

- **TCP 44818**: Explicit messaging (komut/yanıt tabanlı iletişim)
- **UDP 2222**: Implicit messaging (I/O veri değişimi)

### Desteklenen Komutlar

- `Register Session` (0x0065): Yeni bir session oluşturur
- `Unregister Session` (0x0066): Session'ı sonlandırır
- `Send RR Data` (0x006F): Request/Response veri gönderimi
- `List Services` (0x0004): Desteklenen servisleri listeler
- `List Identity` (0x0063): Cihaz kimlik bilgilerini döndürür

### Tag Sistemi

Server'da **100 adet rastgele değişken (tag)** bulunmaktadır. Her tag okunduğunda yeni bir rastgele değer üretilir.

#### Tag Listesi

| # | Tag Adı | Adres | Veri Tipi | Açıklama |
|---|---------|-------|------------|----------|
| 1 | Sensor1A | Tag_1 | DINT (32-bit signed integer) | Sensor sensörü/değişkeni |
| 2 | Motor1A | Tag_2 | DINT (32-bit signed integer) | Motor sensörü/değişkeni |
| 3 | Valve1A | Tag_3 | DINT (32-bit signed integer) | Valve sensörü/değişkeni |
| 4 | Temp1A | Tag_4 | DINT (32-bit signed integer) | Temp sensörü/değişkeni |
| 5 | Pressure1A | Tag_5 | DINT (32-bit signed integer) | Pressure sensörü/değişkeni |
| 6 | Flow1A | Tag_6 | DINT (32-bit signed integer) | Flow sensörü/değişkeni |
| 7 | Level1A | Tag_7 | DINT (32-bit signed integer) | Level sensörü/değişkeni |
| 8 | Speed1A | Tag_8 | DINT (32-bit signed integer) | Speed sensörü/değişkeni |
| 9 | Position1A | Tag_9 | DINT (32-bit signed integer) | Position sensörü/değişkeni |
| 10 | Status1A | Tag_10 | DINT (32-bit signed integer) | Status sensörü/değişkeni |
| 11-20 | Sensor2B, Motor2B, ..., Status2B | Tag_11 - Tag_20 | DINT | İkinci grup tag'ler |
| 21-30 | Sensor3C, Motor3C, ..., Status3C | Tag_21 - Tag_30 | DINT | Üçüncü grup tag'ler |
| 31-40 | Sensor4D, Motor4D, ..., Status4D | Tag_31 - Tag_40 | DINT | Dördüncü grup tag'ler |
| 41-50 | Sensor5E, Motor5E, ..., Status5E | Tag_41 - Tag_50 | DINT | Beşinci grup tag'ler |
| 51-60 | Sensor6F, Motor6F, ..., Status6F | Tag_51 - Tag_60 | DINT | Altıncı grup tag'ler |
| 61-70 | Sensor7G, Motor7G, ..., Status7G | Tag_61 - Tag_70 | DINT | Yedinci grup tag'ler |
| 71-80 | Sensor8H, Motor8H, ..., Status8H | Tag_71 - Tag_80 | DINT | Sekizinci grup tag'ler |
| 81-90 | Sensor9I, Motor9I, ..., Status9I | Tag_81 - Tag_90 | DINT | Dokuzuncu grup tag'ler |
| 91-100 | Sensor10J, Motor10J, ..., Status10J | Tag_91 - Tag_100 | DINT | Onuncu grup tag'ler |

**Tam tag listesi için:** `scripts/generate-tag-list.js` scriptini çalıştırabilirsiniz.

#### Tag Okuma

Tag'ler aşağıdaki yöntemlerle okunabilir:

1. **Tag Adı ile**: Tag adını kullanarak (örn: `Sensor1A`, `Motor2B`)
2. **Adres ile**: Tag adresini kullanarak (örn: `Tag_1`, `Tag_2`)

Her okuma işleminde tag'in değeri **-1,000,000 ile +1,000,000** arasında rastgele bir değer olarak güncellenir.

#### Veri Tipi

- **DINT**: 32-bit signed integer (4 byte)
- **Değer Aralığı**: -1,000,000 ile +1,000,000 arası
- **CIP Servisleri**: Read Tag (0x4C), Get Attribute Single (0x0E)

## Geliştirme

### Debug Modu

Debug loglarını görmek için:

```bash
DEBUG=ethernetip:* npm start
```

### Test

```bash
npm test
```

## Lisans

MIT

## Referanslar

- [EtherNet/IP Specification](https://www.odva.org/technology-standards/ethernet-ip/)
- [Common Industrial Protocol (CIP)](https://www.odva.org/technology-standards/key-technologies/cip/)

