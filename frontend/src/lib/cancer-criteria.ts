export interface CriteriaEntry {
  description: string;
  features: string[];
  imagingClue: string;
  riskLevel: "high" | "normal";
}

export const CANCER_CRITERIA: Record<string, CriteriaEntry> = {
  "Adenocarcinoma": {
    description:
      "The most common lung cancer subtype. Arises from mucus-secreting cells, typically in peripheral lung zones.",
    features: [
      "Peripheral location — outer lung zones, away from major bronchi",
      "Ground-glass opacities (GGO) or mixed GGO/solid components",
      "Irregular, spiculated, or lobulated margins",
      "Sub-pleural or pleural-based positioning",
      "Possible air bronchograms within the lesion",
      "Slow-growing solitary pulmonary nodule pattern",
    ],
    imagingClue:
      "Look for hazy, non-solid (ground-glass) areas alongside denser tissue in peripheral zones — the hallmark mixed-density pattern of adenocarcinoma.",
    riskLevel: "high",
  },

  "Large Cell Carcinoma": {
    description:
      "An aggressive undifferentiated subtype with large cells; lacks glandular or squamous features. Typically peripheral with rapid growth.",
    features: [
      "Large peripheral mass — typically >3 cm in diameter",
      "Well-defined or lobulated outer margins",
      "Possible necrosis or cavitation within the mass",
      "Pleural invasion or pleural thickening nearby",
      "Rapid growth pattern on serial imaging",
      "Associated mediastinal lymphadenopathy",
    ],
    imagingClue:
      "Large, well-defined peripheral mass. The combination of large size, possible necrotic core, and peripheral location are the key indicators.",
    riskLevel: "high",
  },

  "Squamous Cell Carcinoma": {
    description:
      "Centrally located cancer closely linked to smoking history. Originates from bronchial epithelium near the main airways.",
    features: [
      "Central location — hilar or peri-hilar region near main bronchi",
      "Cavitation within the mass (thick, irregular cavity walls)",
      "Atelectasis or obstructive consolidation distal to the lesion",
      "Lobulated or irregular margins",
      "Bronchial wall thickening or signs of bronchial obstruction",
      "Post-obstructive pneumonia pattern in distal lung",
    ],
    imagingClue:
      "Central hilar mass with possible cavitation. Check for signs of bronchial obstruction (atelectasis, air trapping) — these are central-type features specific to SCC.",
    riskLevel: "high",
  },

  "No Cancer": {
    description:
      "Lung tissue appears within normal limits. No malignant features detected by the model.",
    features: [
      "Clear lung parenchyma — no suspicious opacities or consolidations",
      "No nodules, masses or pleural-based abnormalities",
      "Normal bronchial and vascular markings throughout",
      "No pleural effusion or pleural thickening",
      "No hilar or mediastinal enlargement",
      "Symmetric, clear lung fields bilaterally",
    ],
    imagingClue:
      "Lung fields are clear with no abnormal densities, structural changes, or asymmetry between the two lungs.",
    riskLevel: "normal",
  },
};
