import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const Index = () => {
  useEffect(() => {
    document.title = "Bulk WhatsApp Sender Automation";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", "Send bulk WhatsApp messages with text, images, and videos via WhatsApp Web automation.");
  }, []);

  const exampleCmd = `node scripts/whatsapp-bulk-sender.mjs \
  --excel /absolute/path/contacts.xlsx \
  --message "Hello there\\nThis is a multiline message." \
  --image /absolute/path/promo.jpg \
  --video /absolute/path/demo.mp4 \
  --delayMin 2.5 --delayMax 6.5`;

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-accent/30">
      <section className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Bulk WhatsApp Sender (WhatsApp Web Automation)
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Upload an Excel of phone numbers and automatically send multi-line text messages with optional images and videos via WhatsApp Web. Human-like random delays included.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a href="#guide" className="inline-block">
              <Button variant="hero" size="lg">Get Started</Button>
            </a>
            <a href="https://web.whatsapp.com" target="_blank" rel="noreferrer" className="inline-block">
              <Button variant="outline" size="lg">Open WhatsApp Web</Button>
            </a>
          </div>
        </div>
      </section>

      <section id="guide" className="container pb-24">
        <article className="mx-auto max-w-4xl rounded-lg border bg-card shadow-sm p-6 md:p-8">
          <h2 className="text-2xl font-semibold mb-4">How to use</h2>
          <ol className="list-decimal pl-5 space-y-2 text-left text-muted-foreground">
            <li>Prepare an Excel file (xlsx/xls) with a column named <strong>phone</strong> or <strong>number</strong>. Values can include +country codes or use <code className="px-1 rounded bg-secondary">--countryCode</code> to prepend one.</li>
            <li>Install dependencies in this project, then run the script with your file paths.</li>
            <li>On first run, scan the WhatsApp Web QR in the opened browser window.</li>
          </ol>

          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Example command</h3>
            <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 text-sm">
{exampleCmd}
            </pre>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border p-4">
              <h4 className="font-semibold mb-2">Key features</h4>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li>Bulk send to any number count</li>
                <li>Multi-line messages and captions</li>
                <li>Optional image and video attachments</li>
                <li>Human-like randomized delays</li>
              </ul>
            </div>
            <div className="rounded-md border p-4">
              <h4 className="font-semibold mb-2">Useful flags</h4>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li><code className="px-1 rounded bg-secondary">--message</code> or <code className="px-1 rounded bg-secondary">--messageFile</code></li>
                <li><code className="px-1 rounded bg-secondary">--image</code> and/or <code className="px-1 rounded bg-secondary">--video</code></li>
                <li><code className="px-1 rounded bg-secondary">--delayMin</code>, <code className="px-1 rounded bg-secondary">--delayMax</code></li>
                <li><code className="px-1 rounded bg-secondary">--countryCode</code> (e.g., 1, 44, 91)</li>
              </ul>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
};

export default Index;
