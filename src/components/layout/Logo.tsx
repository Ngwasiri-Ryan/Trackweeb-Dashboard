import { Link } from "@/lib/router-compat";

import { brand } from "@/lib/brand";

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="brand-logo-mark">{brand.logoLetter}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold tracking-tight text-foreground">{brand.name}</span>
        <span className="brand-logo-badge">{brand.adminSuffix}</span>
      </div>
    </div>
  );
}

export function LogoLink() {
  return (
    <Link to="/dashboard" className="group flex items-center">
      <Logo />
    </Link>
  );
}
