export type PejvakSendResult = {
  success: boolean;
  recId: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function resolveSoapUrl(endpoint: string): string {
  const withoutQuery = endpoint.trim().replace(/\?.*$/, '').replace(/\/+$/, '');
  if (/send\.asmx$/i.test(withoutQuery)) {
    return withoutQuery;
  }
  return `${withoutQuery}/post/send.asmx`;
}

function isSuccessRecId(value: string): boolean {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return false;
  }
  if (trimmed.startsWith('-')) {
    return false;
  }
  if (trimmed.length >= 5) {
    return true;
  }
  return Number(trimmed) > 100;
}

function parseRecIds(xml: string): string[] {
  const resultBlock =
    xml.match(/<SendSimpleSMSResult[\s\S]*?<\/SendSimpleSMSResult>/i)?.[0] ?? xml;
  return [...resultBlock.matchAll(/<string[^>]*>([\s\S]*?)<\/string>/gi)].map((match) =>
    match[1].trim(),
  );
}

function parseFault(xml: string): string | undefined {
  const fault =
    xml.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i)?.[1] ??
    xml.match(/<soap:Reason>[\s\S]*?<soap:Text[^>]*>([\s\S]*?)<\/soap:Text>/i)?.[1];
  return fault?.trim();
}

export async function sendSimpleSms(params: {
  endpoint: string;
  username: string;
  password: string;
  senderNumber: string;
  phones: string[];
  body: string;
}): Promise<PejvakSendResult[]> {
  const soapUrl = resolveSoapUrl(params.endpoint);
  const toXml = params.phones
    .map((phone) => `<string>${escapeXml(phone)}</string>`)
    .join('');

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <SendSimpleSMS xmlns="http://tempuri.org/">
      <username>${escapeXml(params.username)}</username>
      <password>${escapeXml(params.password)}</password>
      <to>${toXml}</to>
      <from>${escapeXml(params.senderNumber)}</from>
      <text>${escapeXml(params.body)}</text>
      <isflash>false</isflash>
    </SendSimpleSMS>
  </soap:Body>
</soap:Envelope>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  let xml: string;
  try {
    const response = await fetch(soapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: '"http://tempuri.org/SendSimpleSMS"',
      },
      body: envelope,
      signal: controller.signal,
    });
    xml = await response.text();
    if (!response.ok) {
      throw new Error(`پاسخ نامعتبر وب‌سرویس پیامک (${response.status})`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('زمان اتصال به وب‌سرویس پیامک به پایان رسید');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const fault = parseFault(xml);
  if (fault) {
    throw new Error(fault);
  }

  const recIds = parseRecIds(xml);
  if (!recIds.length) {
    throw new Error('پاسخ وب‌سرویس پیامک قابل خواندن نبود');
  }

  return recIds.map((recId, index) => ({
    success: isSuccessRecId(recId),
    recId: recId || `empty-${index}`,
  }));
}
