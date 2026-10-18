-- Restore products, activate all, and sync subcategories from lavka57.by
-- Generated on 2026-08-27

-- 1. Activate all products and set default stock
UPDATE public.products
SET
  is_active = true,
  stock_quantity = 50
WHERE
  is_active = false
  OR stock_quantity IS NULL
  OR stock_quantity <= 0;

-- 2. Populate subcategory for brands from lavka57.by
-- Liquids
UPDATE public.products
SET subcategory = 'Nice Shot'
WHERE category = 'liquid'
  AND (brand ILIKE '%Nice Shot%' OR name ILIKE '%Nice Shot%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Злая Монашка'
WHERE category = 'liquid'
  AND (brand ILIKE '%Злая Монашка%' OR name ILIKE '%Злая Монашка%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Yummy'
WHERE category = 'liquid'
  AND (brand ILIKE '%Yummy%' OR name ILIKE '%Yummy%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'OGGO'
WHERE category = 'liquid'
  AND (brand ILIKE '%OGGO%' OR name ILIKE '%OGGO%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Chrome'
WHERE category = 'liquid'
  AND (brand ILIKE '%Chrome%' OR name ILIKE '%Chrome%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Narcoz'
WHERE category = 'liquid'
  AND (brand ILIKE '%Narcoz%' OR name ILIKE '%Narcoz%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'OutSider'
WHERE category = 'liquid'
  AND (brand ILIKE '%OutSider%' OR name ILIKE '%OutSider%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Морс'
WHERE category = 'liquid'
  AND (brand ILIKE '%Морс%' OR name ILIKE '%Морс%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Hotspot Acid'
WHERE category = 'liquid'
  AND (brand ILIKE '%Hotspot Acid%' OR name ILIKE '%Hotspot Acid%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Hotspot Acid V2'
WHERE category = 'liquid'
  AND (brand ILIKE '%Hotspot Acid V2%' OR name ILIKE '%Hotspot Acid V2%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Hotspot Dont ChewIt'
WHERE category = 'liquid'
  AND (brand ILIKE '%Hotspot Dont ChewIt%' OR name ILIKE '%Hotspot Dont ChewIt%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Hotspot DOT'
WHERE category = 'liquid'
  AND (brand ILIKE '%Hotspot DOT%' OR name ILIKE '%Hotspot DOT%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Hotspot FUEL'
WHERE category = 'liquid'
  AND (brand ILIKE '%Hotspot FUEL%' OR name ILIKE '%Hotspot FUEL%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Hotspot ICE'
WHERE category = 'liquid'
  AND (brand ILIKE '%Hotspot ICE%' OR name ILIKE '%Hotspot ICE%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Glitch Raizin'
WHERE category = 'liquid'
  AND (brand ILIKE '%Glitch Raizin%' OR name ILIKE '%Glitch Raizin%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Annima & Самоубийца'
WHERE category = 'liquid'
  AND (brand ILIKE '%Annima & Самоубийца%' OR name ILIKE '%Annima & Самоубийца%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Animma Love'
WHERE category = 'liquid'
  AND (brand ILIKE '%Animma Love%' OR name ILIKE '%Animma Love%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Самоубийца V2 ACID'
WHERE category = 'liquid'
  AND (brand ILIKE '%Самоубийца V2 ACID%' OR name ILIKE '%Самоубийца V2 ACID%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Elfliq'
WHERE category = 'liquid'
  AND (brand ILIKE '%Elfliq%' OR name ILIKE '%Elfliq%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Podonki Podgon'
WHERE category = 'liquid'
  AND (brand ILIKE '%Podonki Podgon%' OR name ILIKE '%Podonki Podgon%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Podonki Malasian New'
WHERE category = 'liquid'
  AND (brand ILIKE '%Podonki Malasian New%' OR name ILIKE '%Podonki Malasian New%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Rick And Morty На Замерзоне'
WHERE category = 'liquid'
  AND (brand ILIKE '%Rick And Morty На Замерзоне%' OR name ILIKE '%Rick And Morty На Замерзоне%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'RM & Catswill'
WHERE category = 'liquid'
  AND (brand ILIKE '%RM & Catswill%' OR name ILIKE '%RM & Catswill%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Dogswill'
WHERE category = 'liquid'
  AND (brand ILIKE '%Dogswill%' OR name ILIKE '%Dogswill%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Catswill Premium'
WHERE category = 'liquid'
  AND (brand ILIKE '%Catswill Premium%' OR name ILIKE '%Catswill Premium%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Catswill Extra'
WHERE category = 'liquid'
  AND (brand ILIKE '%Catswill Extra%' OR name ILIKE '%Catswill Extra%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'BJORN Тёмный Хор'
WHERE category = 'liquid'
  AND (brand ILIKE '%BJORN Тёмный Хор%' OR name ILIKE '%BJORN Тёмный Хор%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'BJORN Long'
WHERE category = 'liquid'
  AND (brand ILIKE '%BJORN Long%' OR name ILIKE '%BJORN Long%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'BJORN Сон Призрака'
WHERE category = 'liquid'
  AND (brand ILIKE '%BJORN Сон Призрака%' OR name ILIKE '%BJORN Сон Призрака%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Koma Fatality'
WHERE category = 'liquid'
  AND (brand ILIKE '%Koma Fatality%' OR name ILIKE '%Koma Fatality%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Boshki'
WHERE category = 'liquid'
  AND (brand ILIKE '%Boshki%' OR name ILIKE '%Boshki%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Rell Eazy'
WHERE category = 'liquid'
  AND (brand ILIKE '%Rell Eazy%' OR name ILIKE '%Rell Eazy%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Pixel Ice'
WHERE category = 'liquid'
  AND (brand ILIKE '%Pixel Ice%' OR name ILIKE '%Pixel Ice%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'ICE FOX PREMIUM by Iceberg'
WHERE category = 'liquid'
  AND (brand ILIKE '%ICE FOX PREMIUM by Iceberg%' OR name ILIKE '%ICE FOX PREMIUM by Iceberg%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'САМОУБИЙЦА'
WHERE category = 'liquid'
  AND (brand ILIKE '%САМОУБИЙЦА%' OR name ILIKE '%САМОУБИЙЦА%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Annima Love'
WHERE category = 'liquid'
  AND (brand ILIKE '%Annima Love%' OR name ILIKE '%Annima Love%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Морс'
WHERE category = 'liquid'
  AND (
    name ILIKE '%РедБулл%'
    OR name ILIKE '%Спрайт%'
    OR name ILIKE '%Кола%'
    OR name ILIKE '%Энергетик%'
    OR name ILIKE '%Яблоко%'
    OR name ILIKE '%Вишня%'
    OR name ILIKE '%Виноград%'
    OR name ILIKE '%Черника%'
    OR name ILIKE '%Малина%'
    OR name ILIKE '%Клубника%'
    OR name ILIKE '%Персик%'
    OR name ILIKE '%Манго%'
    OR name ILIKE '%Банан%'
    OR name ILIKE '%Арбуз%'
    OR name ILIKE '%Лимон%'
    OR name ILIKE '%Лайм%'
    OR name ILIKE '%Мята%'
    OR name ILIKE '%Ментол%'
    OR name ILIKE '%Ананас%'
    OR name ILIKE '%Голубика%'
    OR name ILIKE '%Киви%'
    OR name ILIKE '%Смородина%'
    OR name ILIKE '%Ежевика%'
    OR name ILIKE '%Тутти%'
    OR name ILIKE '%Фрутти%'
    OR name ILIKE '%Скитлс%'
    OR name ILIKE '%Холлс%'
    OR name ILIKE '%Эклипс%'
    OR name ILIKE '%Ментос%'
    OR name ILIKE '%Нектарин%'
    OR name ILIKE '%Чупа%'
    OR name ILIKE '%Варенье%'
    OR name ILIKE '%Жвачка%'
    OR name ILIKE '%Коктейль%'
    OR name ILIKE '%Морс%'
    OR name ILIKE '%Апельсин%'
    OR name ILIKE '%Клюква%'
    OR name ILIKE '%Фанта%'
    OR name ILIKE '%Маракуйя%'
    OR name ILIKE '%Земляника%'
    OR name ILIKE '%Абрикос%'
    OR name ILIKE '%Алоэ%'
    OR name ILIKE '%Сакура%'
    OR name ILIKE '%Хубба%'
    OR name ILIKE '%Бубба%'
    OR name ILIKE '%Червей%'
    OR name ILIKE '%Мятный%'
    OR name ILIKE '%Мятные%'
    OR name ILIKE '%Ледяной%'
    OR name ILIKE '%Ледяная%'
    OR name ILIKE '%Ледяное%'
    OR name ILIKE '%Дикая%'
    OR name ILIKE '%Тёмный%'
    OR name ILIKE '%Сочный%'
    OR name ILIKE '%Тропический%'
    OR name ILIKE '%Микс%'
  )
  AND subcategory IS NULL;

-- Disposables
UPDATE public.products
SET subcategory = 'Elf Bar'
WHERE category = 'disposable'
  AND (brand ILIKE '%Elf Bar%' OR name ILIKE '%Elf Bar%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Lost Mary'
WHERE category = 'disposable'
  AND (brand ILIKE '%Lost Mary%' OR name ILIKE '%Lost Mary%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'HQD'
WHERE category = 'disposable'
  AND (brand ILIKE '%HQD%' OR name ILIKE '%HQD%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Waka'
WHERE category = 'disposable'
  AND (brand ILIKE '%Waka%' OR name ILIKE '%Waka%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'MOTI GO PRO'
WHERE category = 'disposable'
  AND (brand ILIKE '%MOTI GO PRO%' OR name ILIKE '%MOTI GO PRO%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'KPEKPE PS'
WHERE category = 'disposable'
  AND (brand ILIKE '%KPEKPE PS%' OR name ILIKE '%KPEKPE PS%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'PUFFMI DURA'
WHERE category = 'disposable'
  AND (brand ILIKE '%PUFFMI DURA%' OR name ILIKE '%PUFFMI DURA%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'VOZOL VISTA'
WHERE category = 'disposable'
  AND (brand ILIKE '%VOZOL VISTA%' OR name ILIKE '%VOZOL VISTA%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'RETURN PULSE'
WHERE category = 'disposable'
  AND (brand ILIKE '%RETURN PULSE%' OR name ILIKE '%RETURN PULSE%')
  AND subcategory IS NULL;

-- Snus
UPDATE public.products
SET subcategory = 'RED'
WHERE category = 'snus'
  AND (brand ILIKE '%RED%' OR name ILIKE '%RED%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Glitch'
WHERE category = 'snus'
  AND (brand ILIKE '%Glitch%' OR name ILIKE '%Glitch%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Iceberg'
WHERE category = 'snus'
  AND (brand ILIKE '%Iceberg%' OR name ILIKE '%Iceberg%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'САМОУБИЙЦА'
WHERE category = 'snus'
  AND (brand ILIKE '%САМОУБИЙЦА%' OR name ILIKE '%САМОУБИЙЦА%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'DryMost'
WHERE category = 'snus'
  AND (brand ILIKE '%DryMost%' OR name ILIKE '%DryMost%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'D.L.T.A.'
WHERE category = 'snus'
  AND (brand ILIKE '%D.L.T.A.%' OR name ILIKE '%D.L.T.A.%')
  AND subcategory IS NULL;

-- Devices
UPDATE public.products
SET subcategory = 'VooPoo'
WHERE category = 'device'
  AND (brand ILIKE '%VooPoo%' OR name ILIKE '%VooPoo%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'GeekVape'
WHERE category = 'device'
  AND (brand ILIKE '%GeekVape%' OR name ILIKE '%GeekVape%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Vaporesso'
WHERE category = 'device'
  AND (brand ILIKE '%Vaporesso%' OR name ILIKE '%Vaporesso%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'SMOK'
WHERE category = 'device'
  AND (brand ILIKE '%SMOK%' OR name ILIKE '%SMOK%')
  AND subcategory IS NULL;

-- Consumables
UPDATE public.products
SET subcategory = 'VAPORESSO'
WHERE category = 'consumable'
  AND (brand ILIKE '%VAPORESSO%' OR name ILIKE '%VAPORESSO%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'VOOPOO'
WHERE category = 'consumable'
  AND (brand ILIKE '%VOOPOO%' OR name ILIKE '%VOOPOO%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'GEEKVAPE'
WHERE category = 'consumable'
  AND (brand ILIKE '%GEEKVAPE%' OR name ILIKE '%GEEKVAPE%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'Manto Aio'
WHERE category = 'consumable'
  AND (brand ILIKE '%Manto Aio%' OR name ILIKE '%Manto Aio%')
  AND subcategory IS NULL;

UPDATE public.products
SET subcategory = 'АКБ'
WHERE category = 'consumable'
  AND (brand ILIKE '%АКБ%' OR name ILIKE '%АКБ%')
  AND subcategory IS NULL;
