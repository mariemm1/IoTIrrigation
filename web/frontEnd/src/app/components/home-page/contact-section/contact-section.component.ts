import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgParticlesModule } from 'ng-particles';
import { ISourceOptions, Engine } from 'tsparticles-engine';
import { loadSlim } from 'tsparticles-slim';

@Component({
  selector: 'app-contact-section',
  standalone: true,
  imports: [CommonModule, NgParticlesModule],
  templateUrl: './contact-section.component.html',
  styleUrls: ['./contact-section.component.css'],
})
export class ContactSectionComponent {
  particlesOptions: ISourceOptions = {
    background: { color: { value: 'transparent' } },
    fpsLimit: 60,
    interactivity: {
      events: { onHover: { enable: true, mode: 'repulse' }, resize: true },
      modes: { repulse: { distance: 100, duration: 0.4 } },
    },
    particles: {
      color: { value: '#ffffff' },
      links: { color: '#00bfff', distance: 130, enable: true, opacity: 0.4, width: 1 },
      move: { enable: true, speed: 0.6, direction: 'none', outModes: { default: 'bounce' } },
      number: { density: { enable: true, area: 800 }, value: 80 },
      opacity: { value: 0.55 },
      shape: { type: ['circle'] },
      size: { value: { min: 1, max: 3 } },
    },
    detectRetina: true,
  };

  particlesInit = async (engine: Engine): Promise<void> => { await loadSlim(engine); };
}
