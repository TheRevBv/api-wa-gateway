const digitsOnly = (value: string): string => value.replace(/[^\d]/g, "");

const isMexicoMobileWaId = (value: string): boolean => value.startsWith("521") && value.length === 13;

export const normalizeWhatsAppPhone = (value: string): string => {
  const digits = digitsOnly(value);

  // Meta often returns Mexico WhatsApp IDs as 521XXXXXXXXXX while outbound sends use 52XXXXXXXXXX.
  if (digits.startsWith("52") && digits.length === 12) {
    return `521${digits.slice(2)}`;
  }

  return digits;
};

export const getWhatsAppPhoneLookupCandidates = (value: string): string[] => {
  const normalized = normalizeWhatsAppPhone(value);

  if (!isMexicoMobileWaId(normalized)) {
    return [normalized];
  }

  const mexicoWithoutMobilePrefix = `52${normalized.slice(3)}`;

  return [normalized, mexicoWithoutMobilePrefix];
};
