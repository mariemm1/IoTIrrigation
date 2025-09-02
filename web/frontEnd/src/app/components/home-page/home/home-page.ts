import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TopNavComponent } from '../top-nav/top-nav.component';
import { HomeHeroComponent } from '../home-hero/home-hero.component';
import { AboutSectionComponent } from '../about-section/about-section.component';
import { SolutionsSectionComponent } from '../solutions-section/solutions-section.component';
import { ProductsSectionComponent } from '../products-section/products-section.component';
import { ContactSectionComponent } from '../contact-section/contact-section.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    TopNavComponent,
    HomeHeroComponent,
    AboutSectionComponent,
    SolutionsSectionComponent,
    ProductsSectionComponent,
    ContactSectionComponent
  ],
  templateUrl: './home-page.html',
  styleUrls: ['./home-page.css'],
})
export class HomePage {}
