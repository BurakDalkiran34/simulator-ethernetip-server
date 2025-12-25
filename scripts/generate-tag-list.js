/**
 * Generate tag list for documentation
 */

const prefixes = ['Sensor', 'Motor', 'Valve', 'Temp', 'Pressure', 'Flow', 'Level', 'Speed', 'Position', 'Status'];
const suffixes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

function generateTagNames(count) {
  const names = [];
  for (let i = 0; i < count; i++) {
    const prefix = prefixes[i % prefixes.length];
    const suffix = suffixes[Math.floor(i / prefixes.length)];
    const number = Math.floor(i / 10) + 1;
    names.push(`${prefix}${number}${suffix}`);
  }
  return names;
}

const tags = generateTagNames(100);
console.log('## Tag Listesi (100 Tag)\n');
console.log('Server\'da 100 adet rastgele değişken (tag) bulunmaktadır. Her tag okunduğunda yeni bir rastgele değer üretilir.\n');
console.log('| # | Tag Adı | Adres | Veri Tipi | Açıklama |');
console.log('|---|---------|-------|------------|----------|');

tags.forEach((name, index) => {
  const address = `Tag_${index + 1}`;
  const prefix = prefixes[index % prefixes.length];
  const description = `${prefix} sensörü/değişkeni`;
  console.log(`| ${index + 1} | ${name} | ${address} | DINT (32-bit signed integer) | ${description} |`);
});

console.log('\n### Tag Okuma\n');
console.log('Tag\'ler aşağıdaki yöntemlerle okunabilir:\n');
console.log('1. **Tag Adı ile**: Tag adını kullanarak (örn: `Sensor1A`, `Motor2B`)');
console.log('2. **Adres ile**: Tag adresini kullanarak (örn: `Tag_1`, `Tag_2`)\n');
console.log('Her okuma işleminde tag\'in değeri -1,000,000 ile +1,000,000 arasında rastgele bir değer olarak güncellenir.\n');
console.log('### Veri Tipi\n');
console.log('- **DINT**: 32-bit signed integer (4 byte)');
console.log('- **Değer Aralığı**: -1,000,000 ile +1,000,000 arası');

