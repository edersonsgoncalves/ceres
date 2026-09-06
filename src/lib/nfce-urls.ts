export const NFCE_QR_URLS: Record<string, string> = {
  AC: "http://www.sefaznet.ac.gov.br/nfce/qrcode?",
  AL: "http://nfce.sefaz.al.gov.br/QRCode/consultarNFCe.jsp",
  AM: "http://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp?",
  AP: "https://www.sefaz.ap.gov.br/nfce/nfcep.php",
  BA: "http://nfe.sefaz.ba.gov.br/servicos/nfce/qrcode.aspx",
  CE: "http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?",
  DF: "http://www.fazenda.df.gov.br/nfce/qrcode?",
  ES: "http://app.sefaz.es.gov.br/ConsultaNFCe/",
  GO: "https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe",
  MA: "http://nfce.sefaz.ma.gov.br/portal/consultarNFCe.jsp",
  MG: "https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml",
  MS: "http://www.dfe.ms.gov.br/nfce/qrcode?",
  MT: "http://www.sefaz.mt.gov.br/nfce/consultanfce",
  PA: "https://appnfc.sefa.pa.gov.br/portal/view/consultas/nfce/nfceForm.seam",
  PB: "http://www.sefaz.pb.gov.br/nfce",
  PE: "http://nfce.sefaz.pe.gov.br/nfce/consulta",
  PI: "http://www.sefaz.pi.gov.br/nfce/qrcode",
  PR: "http://www.fazenda.pr.gov.br/nfce/qrcode?",
  RJ: "https://consultadfe.fazenda.rj.gov.br/consultaNFCe/QRCode",
  RN: "http://nfce.set.rn.gov.br/consultarNFCe.aspx",
  RO: "http://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp",
  RR: "https://www.sefaz.rr.gov.br/nfce/servlet/qrcode",
  RS: "https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx",
  SC: "https://sat.sef.sc.gov.br/nfce/consulta?",
  SE: "http://www.nfce.se.gov.br/nfce/qrcode",
  SP: "https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx",
  TO: "http://www.sefaz.to.gov.br/nfce/qrcode",
};

export function detectStateFromUrl(url: string): string | null {
  const lower = url.toLowerCase();
  for (const [state, baseUrl] of Object.entries(NFCE_QR_URLS)) {
    if (lower.includes(baseUrl.toLowerCase().slice(0, 20))) {
      return state;
    }
  }
  if (lower.includes("fazenda.rj")) return "RJ";
  if (lower.includes("fazenda.sp")) return "SP";
  if (lower.includes("sefaz.rs")) return "RS";
  if (lower.includes("fazenda.mg")) return "MG";
  if (lower.includes("sefaz.ba")) return "BA";
  if (lower.includes("sefaz.ce")) return "CE";
  if (lower.includes("fazenda.df")) return "DF";
  if (lower.includes("sefaz.pe")) return "PE";
  if (lower.includes("sefaz.go")) return "GO";
  if (lower.includes("sefaz.sc")) return "SC";
  if (lower.includes("sefaz.ma")) return "MA";
  if (lower.includes("sefaz.al")) return "AL";
  if (lower.includes("sefaz.am")) return "AM";
  if (lower.includes("sefaz.ap")) return "AP";
  if (lower.includes("sefaz.mt")) return "MT";
  if (lower.includes("sefaz.ms")) return "MS";
  if (lower.includes("sefaz.pa")) return "PA";
  if (lower.includes("sefaz.pb")) return "PB";
  if (lower.includes("sefaz.pi")) return "PI";
  if (lower.includes("sefaz.pr")) return "PR";
  if (lower.includes("sefaz.rn")) return "RN";
  if (lower.includes("sefaz.ro")) return "RO";
  if (lower.includes("sefaz.rr")) return "RR";
  if (lower.includes("sefaz.se")) return "SE";
  if (lower.includes("sefaz.to")) return "TO";
  if (lower.includes("sefaz.ac")) return "AC";
  return null;
}
