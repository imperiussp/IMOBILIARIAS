function safeSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "arquivo";
}

export function agencyBrandingPath(agencyId: string, fileName: string) {
  return `${agencyId}/branding/${safeSegment(fileName)}`;
}

export function propertyPhotoPaths(agencyId: string, propertyId: string, origin: "admin" | "mobile" | "sync", token: string) {
  const name = `${safeSegment(token)}.jpg`;
  const base = `${agencyId}/${propertyId}/photos/${origin}`;
  return {
    full: `${base}/${name}`,
    thumbnail: `${base}/thumbs/${name}`,
  };
}

export function propertyDocumentPath(agencyId: string, propertyId: string, fileName: string) {
  return `${agencyId}/properties/${propertyId}/documents/${safeSegment(fileName)}`;
}

export function agencyGeneratedDocumentPath(agencyId: string, documentId: string, fileName: string) {
  return `${agencyId}/documents/generated/${documentId}/${safeSegment(fileName)}`;
}

export function agencyUploadedDocumentPath(agencyId: string, fileName: string) {
  return `${agencyId}/documents/uploads/${safeSegment(fileName)}`;
}

export function brokerMediaPath(agencyId: string, brokerId: string, fileName: string) {
  return `${agencyId}/brokers/${brokerId}/${safeSegment(fileName)}`;
}
