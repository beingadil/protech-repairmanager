import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sidebarFile = readFileSync(join(__dirname, '..', 'Sidebar.tsx'), 'utf-8');
const topbarFile = readFileSync(join(__dirname, '..', 'TopBar.tsx'), 'utf-8');

describe('Sidebar accessibility contract', () => {
  it('nav element has a main navigation aria-label', () => {
    expect(sidebarFile).toMatch(/<nav [^>]*aria-label="Main navigation"/);
  });

  it('nav links have aria-label and conditional title attributes for collapsed state', () => {
    expect(sidebarFile).toMatch(/aria-label=\{item\.label\}/);
    expect(sidebarFile).toMatch(/title=\{\!isSidebarOpen \? item\.label : undefined\}/);
  });

  it('quick action button has aria-label and title attributes', () => {
    expect(sidebarFile).toMatch(/aria-label="New Repair Job"/);
    expect(sidebarFile).toMatch(/title=\{\!isSidebarOpen \? 'New Repair Job' : undefined\}/);
  });

  it('theme toggle in sidebar has aria-label', () => {
    expect(sidebarFile).toMatch(/aria-label=\{isDark \? 'Switch to Light Mode' : 'Switch to Dark Mode'\}/);
  });
});

describe('TopBar accessibility contract', () => {
  it('toggle sidebar button has aria-label', () => {
    expect(topbarFile).toMatch(/aria-label="Toggle Navigation Sidebar"/);
  });

  it('search trigger button has aria-label', () => {
    expect(topbarFile).toMatch(/aria-label="Search jobs"/);
  });

  it('theme toggle button has aria-label', () => {
    expect(topbarFile).toMatch(/aria-label=\{isDark \? 'Switch to Light Mode' : 'Switch to Dark Mode'\}/);
  });

  it('logout button has aria-label', () => {
    expect(topbarFile).toMatch(/aria-label="Log out"/);
  });
});
