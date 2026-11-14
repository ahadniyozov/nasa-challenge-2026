// TEMPORARY Russian for the engineering-center redesign (screens, HUD, drawing). Delete before the final build.
export const RU_UI: Record<string, string> = {
  // shell
  Menu: 'Меню', Missions: 'Миссии', Resources: 'Ресурсы', 'Sound on': 'Звук включён', 'Sound off': 'Звук выключен',
  // manifest
  'Mission manifest': 'Список миссий',
  'Six customers, six satellites. Each mission adds one new engineering problem. Earn a star to unlock the next one.':
    'Шесть заказчиков, шесть спутников. Каждая миссия добавляет одну новую инженерную задачу. Получи звезду, чтобы открыть следующую.',
  'Earn a star on mission {n} to unlock': 'Откроется после звезды в миссии {n}',
  budget: 'бюджет', '1 year': '1 год', '{n} years': '{n} лет', '{n} of 3 stars': '{n} из 3 звёзд',
  'Stars earned: {n} of {m}': 'Звёзд получено: {n} из {m}', 'Unlock all missions': 'Открыть все миссии',
  // brief
  'All missions': 'Все миссии', 'Mission {n}: {title}': 'Миссия {n}: {title}', Requirements: 'Требования', ID: 'Номер',
  'The satellite must': 'Спутник должен',
  'Our engineers already built a cheap test satellite. Fly it first and see what happens.': 'Наши инженеры уже собрали дешёвый пробный спутник. Запусти его и посмотри, что будет.',
  'Fly the test satellite': 'Запустить пробный спутник', 'Design my own': 'Спроектировать свой', 'Design the satellite': 'Спроектировать спутник',
  Budget: 'Бюджет', 'Mission length': 'Срок миссии', Goal: 'Цель', Difficulty: 'Сложность', 'What you will learn': 'Чему научишься', 'Based on': 'По материалам',
  // report
  'Mission accomplished': 'Миссия выполнена', '{met} of {n} requirements met': 'Выполнено требований: {met} из {n}',
  Verification: 'Проверка', 'Result in flight': 'Результат полёта', Status: 'Статус', Met: 'Выполнено', 'Not met': 'Не выполнено',
  Findings: 'Выводы', 'Change {s}': 'Изменить: {s}', 'For three stars deliver {n} or more.': 'Для трёх звёзд доставь {n} или больше.',
  'All missions done': 'Все миссии пройдены', 'Redesign the satellite': 'Переделать спутник', 'Fly again': 'Лететь снова', 'Improve the design': 'Улучшить проект',
  'Delivered to Earth: {d} of {n} {label}': 'Доставлено на Землю: {d} из {n} ({label})',
  'Solar storms crashed the computer {n} time(s). Turn on safe mode before a storm (SPACE or the Safe mode button), or pay for a radiation-hardened computer.':
    'Солнечные бури ломали компьютер {n} раз(а). Включай безопасный режим перед бурей (ПРОБЕЛ или кнопка «Безопасный режим») или поставь защищённый от радиации компьютер.',
  'The UHF radio is far too slow - photos stayed on board. An S-band radio sends them home in seconds.':
    'Радио УКВ слишком медленное — фото остались на борту. Радио S-диапазона отправит их домой за секунды.',
  // build
  Platform: 'Платформа', Mass: 'Масса', Power: 'Энергия', Spacecraft: 'Спутник', 'Launch and operations': 'Запуск и управление',
  'GO for launch': 'GO — к запуску', 'NO-GO': 'NO-GO', 'Launch anyway': 'Всё равно запустить', 'Over the limit: {list}': 'Выше нормы: {list}',
  'UHF radio': 'Радио УКВ', 'S-band radio': 'Радио S-диапазона', 'X-band dish': 'Тарелка X-диапазона',
  'panels {g} W, load {u} W': 'панели {g} Вт, нагрузка {u} Вт',
  Body: 'Корпус', 'gold MLI foil': 'золотая теплоизоляция', 'Drawing of your satellite': 'Чертёж твоего спутника', 'Earth (nadir)': 'Земля (надир)',
  // flight
  'Photo taken': 'Снимок сделан', 'Debris strike. One photo lost': 'Удар обломка. Потерян один снимок',
  'Memory full. Fly over a ground station': 'Память заполнена. Пролети над наземной станцией',
  'Too dark for this camera': 'Слишком темно для этой камеры', 'Too blurry from this altitude': 'С этой высоты слишком размыто',
  'Satellite asleep': 'Спутник спит', 'Out of reach: this orbit never flies that far north': 'Вне досягаемости: эта орбита так далеко на север не летает',
  'Solar storm ahead. Safe mode protects the computer': 'Впереди солнечная буря. Безопасный режим защитит компьютер',
  'Safe mode: asleep, but safe': 'Безопасный режим: спит, но цел', 'Hardened computer kept working': 'Защищённый компьютер продолжил работу',
  'Radiation crashed the computer. Memory lost': 'Радиация сломала компьютер. Память стёрта', 'Battery empty. Satellite asleep': 'Батарея разряжена. Спутник спит',
  'Orbit decayed. The satellite burned up': 'Орбита снизилась. Спутник сгорел', 'Parts wore out. The satellite stopped working': 'Детали износились. Спутник перестал работать',
  'Delivered to Earth': 'Доставлено на Землю', Hull: 'Прочность', "Sunlight and Earth's shadow on this orbit": 'Солнце и тень Земли на этой орбите',
  "In Earth's shadow": 'В тени Земли', 'In sunlight, charging': 'На солнце, зарядка', 'Downlink: sending data home': 'Связь: данные идут домой',
  'Solar storm ahead': 'Впереди солнечная буря', 'Solar storm': 'Солнечная буря',
  'Use the arrow keys to change lane.': 'Стрелки ← → меняют полосу.', 'Tap Safe mode during solar storms.': 'Во время бури нажми «Безопасный режим».',
  'SPACE turns on safe mode during solar storms.': 'ПРОБЕЛ включает безопасный режим во время бурь.',
  'Move left': 'Влево', 'Move right': 'Вправо', 'Safe mode': 'Безопасный режим',
  'Fly over a target to take a photo, then over a ground station to send it home.': 'Пролети над целью, чтобы сделать снимок, потом над наземной станцией, чтобы отправить его домой.',
  'Fly over a fire to photograph it, then over a ground station to send the photo home.': 'Пролети над пожаром, чтобы снять его, потом над наземной станцией, чтобы отправить снимок домой.',
  'Fly over glaciers to photograph them, then over a ground station to send the photos home.': 'Пролетай над ледниками, потом над наземной станцией, чтобы отправить снимки домой.',
  'Fly over hurricanes to image them and send the images home.': 'Пролетай над ураганами и отправляй снимки домой.',
  'Fly through particle clouds to measure them, then over a ground station to send the data home.': 'Пролетай сквозь облака частиц, потом над наземной станцией, чтобы отправить данные домой.',
  'Fly over cities to photograph them, then over a ground station to send the photos home.': 'Пролетай над городами, потом над наземной станцией, чтобы отправить снимки домой.',
  // launch
  'Spacecraft separation. In orbit': 'Отделение спутника. Он на орбите', '{rocket} rocket to {km} km': 'Ракета «{rocket}» на высоту {km} км',
};
