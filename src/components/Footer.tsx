export default function Footer() {
  return (
    <footer className="relative border-t border-ink/10 bg-cream text-ink">
      <div className="content-wrap py-12">
        <p className="text-xs leading-[1.9] text-stone">
          Plot No. 60 &amp; 61, B Block, Kavuri Hills,
          <br />
          Guttala Begumpet Village, Serilingampally Mandal and Municipality,
          <br />
          Ranga Reddy District, Hyderabad — 500081
        </p>
        <div className="mt-8 flex flex-col gap-3 md:flex-row md:justify-between md:gap-0">
          <p className="text-xs text-stone">© 2026 Maison de Build · Hyderabad</p>
          <p className="text-xs text-stone">Built by Tachtix AI</p>
        </div>
      </div>
    </footer>
  );
}
