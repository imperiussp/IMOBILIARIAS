function safeSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "arquivo";
}

export function mobilePropertyPhotoPaths(agencyId: string, propertyId: string, origin: "mobile" | "mobile-edit" | "sync", token: string) {
  const name = `${safeSegment(token)}.jpg`;
  const base = `${agencyId}/${propertyId}/photos/${origin}`;
  return {
    full: `${base}/${name}`,
    thumbnail: `${base}/thumbs/${name}`,
  };
}

export function mobileBrokerMediaPath(agencyId: string, brokerId: string, fileName: string) {
  return `${agencyId}/brokers/${brokerId}/${safeSegment(fileName)}`;
}
