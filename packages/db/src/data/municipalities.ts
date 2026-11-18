export interface MunicipalityData {
  wilayaCode: number;
  nameAr: string;
  nameFr: string;
}

/**
 * Real municipalities for the most populated wilayas. This is a curated subset
 * used to power onboarding address selection; the complete nationwide dataset
 * (1541 communes) is imported separately as a data task. Names are the official
 * commune names; postal codes are left null until the full import.
 */
export const MUNICIPALITIES: readonly MunicipalityData[] = [
  // Alger (16)
  { wilayaCode: 16, nameAr: 'الجزائر الوسطى', nameFr: 'Alger Centre' },
  { wilayaCode: 16, nameAr: 'سيدي امحمد', nameFr: "Sidi M'Hamed" },
  { wilayaCode: 16, nameAr: 'المدنية', nameFr: 'El Madania' },
  { wilayaCode: 16, nameAr: 'بلوزداد', nameFr: 'Belouizdad' },
  { wilayaCode: 16, nameAr: 'باب الوادي', nameFr: 'Bab El Oued' },
  { wilayaCode: 16, nameAr: 'القصبة', nameFr: 'Casbah' },
  { wilayaCode: 16, nameAr: 'بئر مراد رايس', nameFr: 'Bir Mourad Raïs' },
  { wilayaCode: 16, nameAr: 'الأبيار', nameFr: 'El Biar' },
  { wilayaCode: 16, nameAr: 'بوزريعة', nameFr: 'Bouzaréah' },
  { wilayaCode: 16, nameAr: 'بئر خادم', nameFr: 'Birkhadem' },
  { wilayaCode: 16, nameAr: 'الحراش', nameFr: 'El Harrach' },
  { wilayaCode: 16, nameAr: 'براقي', nameFr: 'Baraki' },
  { wilayaCode: 16, nameAr: 'حسين داي', nameFr: 'Hussein Dey' },
  { wilayaCode: 16, nameAr: 'القبة', nameFr: 'Kouba' },
  { wilayaCode: 16, nameAr: 'باش جراح', nameFr: 'Bachdjerrah' },
  { wilayaCode: 16, nameAr: 'بن عكنون', nameFr: 'Ben Aknoun' },
  { wilayaCode: 16, nameAr: 'بني مسوس', nameFr: 'Beni Messous' },
  { wilayaCode: 16, nameAr: 'الدرارية', nameFr: 'Draria' },
  { wilayaCode: 16, nameAr: 'الشراقة', nameFr: 'Chéraga' },
  { wilayaCode: 16, nameAr: 'دالي إبراهيم', nameFr: 'Dély Ibrahim' },
  { wilayaCode: 16, nameAr: 'عين البنيان', nameFr: 'Aïn Benian' },
  { wilayaCode: 16, nameAr: 'سطاوالي', nameFr: 'Staoueli' },
  { wilayaCode: 16, nameAr: 'زرالدة', nameFr: 'Zeralda' },
  { wilayaCode: 16, nameAr: 'العاشور', nameFr: 'El Achour' },
  { wilayaCode: 16, nameAr: 'أولاد فايت', nameFr: 'Ouled Fayet' },
  { wilayaCode: 16, nameAr: 'الحمامات', nameFr: 'Hammamet' },
  { wilayaCode: 16, nameAr: 'برج الكيفان', nameFr: 'Bordj El Kiffan' },
  { wilayaCode: 16, nameAr: 'برج البحري', nameFr: 'Bordj El Bahri' },
  { wilayaCode: 16, nameAr: 'المرسى', nameFr: 'El Marsa' },
  { wilayaCode: 16, nameAr: 'عين طاية', nameFr: 'Aïn Taya' },
  { wilayaCode: 16, nameAr: 'هراوة', nameFr: 'Heuraoua' },
  { wilayaCode: 16, nameAr: 'الرغاية', nameFr: 'Reghaia' },
  { wilayaCode: 16, nameAr: 'الرويبة', nameFr: 'Rouiba' },
  { wilayaCode: 16, nameAr: 'الدار البيضاء', nameFr: 'Dar El Beïda' },
  { wilayaCode: 16, nameAr: 'باب الزوار', nameFr: 'Bab Ezzouar' },
  { wilayaCode: 16, nameAr: 'المحمدية', nameFr: 'Mohammadia' },
  // Oran (31)
  { wilayaCode: 31, nameAr: 'وهران', nameFr: 'Oran' },
  { wilayaCode: 31, nameAr: 'السانية', nameFr: 'Es Sénia' },
  { wilayaCode: 31, nameAr: 'بئر الجير', nameFr: 'Bir El Djir' },
  { wilayaCode: 31, nameAr: 'حاسي بونيف', nameFr: 'Hassi Bounif' },
  { wilayaCode: 31, nameAr: 'عين الترك', nameFr: 'Aïn Turk' },
  { wilayaCode: 31, nameAr: 'أرزيو', nameFr: 'Arzew' },
  { wilayaCode: 31, nameAr: 'بطيوة', nameFr: 'Bethioua' },
  { wilayaCode: 31, nameAr: 'قديل', nameFr: 'Gdyel' },
  { wilayaCode: 31, nameAr: 'سيدي الشامي', nameFr: 'Sidi Chami' },
  { wilayaCode: 31, nameAr: 'طفراوي', nameFr: 'Tafraoui' },
  { wilayaCode: 31, nameAr: 'مسرغين', nameFr: 'Misserghin' },
  { wilayaCode: 31, nameAr: 'بوتليليس', nameFr: 'Boutlelis' },
  { wilayaCode: 31, nameAr: 'وادي تليلات', nameFr: 'Oued Tlelat' },
  { wilayaCode: 31, nameAr: 'الكرمة', nameFr: 'El Kerma' },
  { wilayaCode: 31, nameAr: 'بوسفر', nameFr: 'Bousfer' },
  { wilayaCode: 31, nameAr: 'العنصر', nameFr: 'El Ançor' },
  { wilayaCode: 31, nameAr: 'مرس الحجاج', nameFr: 'Mers El Hadjadj' },
  // Constantine (25)
  { wilayaCode: 25, nameAr: 'قسنطينة', nameFr: 'Constantine' },
  { wilayaCode: 25, nameAr: 'الخروب', nameFr: 'El Khroub' },
  { wilayaCode: 25, nameAr: 'عين سمارة', nameFr: 'Aïn Smara' },
  { wilayaCode: 25, nameAr: 'حامة بوزيان', nameFr: 'Hamma Bouziane' },
  { wilayaCode: 25, nameAr: 'ديدوش مراد', nameFr: 'Didouche Mourad' },
  { wilayaCode: 25, nameAr: 'زيغود يوسف', nameFr: 'Zighoud Youcef' },
  { wilayaCode: 25, nameAr: 'بني حميدان', nameFr: 'Beni Hamiden' },
  { wilayaCode: 25, nameAr: 'عين عبيد', nameFr: 'Aïn Abid' },
  { wilayaCode: 25, nameAr: 'ابن باديس', nameFr: 'Ibn Badis' },
  { wilayaCode: 25, nameAr: 'أولاد رحمون', nameFr: 'Ouled Rahmoune' },
  { wilayaCode: 25, nameAr: 'مسعود بوجريو', nameFr: 'Messaoud Boudjeriou' },
];