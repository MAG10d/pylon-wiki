function acceptsMarkdown(acceptHeader) {
  if (!acceptHeader) return false;
  return acceptHeader
    .toLowerCase()
    .split(',')
    .map((part) => part.trim())
    .some((part) => part.startsWith('text/markdown'));
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function toAbsoluteUrl(baseUrl, href) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function htmlToMarkdown(html, baseUrl) {
  let markdown = html;

  markdown = markdown.replace(/<script[\s\S]*?<\/script>/gi, '');
  markdown = markdown.replace(/<style[\s\S]*?<\/style>/gi, '');

  markdown = markdown.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, content) => {
    const depth = '#'.repeat(Number(level));
    return `\n\n${depth} ${content.trim()}\n\n`;
  });

  markdown = markdown.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    const absoluteHref = toAbsoluteUrl(baseUrl, href);
    return `[${cleanText || absoluteHref}](${absoluteHref})`;
  });

  markdown = markdown.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => `\n- ${content.trim()}`);
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  markdown = markdown.replace(/<\/(p|div|section|article|main|header|footer|nav)>/gi, '\n\n');
  markdown = markdown.replace(/<(p|div|section|article|main|header|footer|nav)[^>]*>/gi, '');

  markdown = markdown.replace(/<[^>]+>/g, '');
  markdown = decodeHtmlEntities(markdown);

  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();

  return `${markdown}\n`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const upstream = await env.ASSETS.fetch(request);

  const vary = upstream.headers.get('Vary');
  const varyWithAccept = vary ? `${vary}, Accept` : 'Accept';

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const passthroughHeaders = new Headers(upstream.headers);
    passthroughHeaders.set('Vary', varyWithAccept);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: passthroughHeaders,
    });
  }

  const accept = request.headers.get('Accept');
  const contentType = upstream.headers.get('Content-Type') || '';

  if (!acceptsMarkdown(accept) || !contentType.toLowerCase().includes('text/html')) {
    const passthroughHeaders = new Headers(upstream.headers);
    passthroughHeaders.set('Vary', varyWithAccept);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: passthroughHeaders,
    });
  }

  const html = await upstream.text();
  const markdown = htmlToMarkdown(html, request.url);

  const headers = new Headers(upstream.headers);
  headers.set('Content-Type', 'text/markdown; charset=utf-8');
  headers.set('Vary', varyWithAccept);
  headers.set('x-markdown-tokens', String(markdown.split(/\s+/).filter(Boolean).length));

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  }

  return new Response(markdown, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
