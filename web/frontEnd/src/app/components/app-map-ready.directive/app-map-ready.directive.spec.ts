import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppMapReadyDirective } from './app-map-ready.directive';

describe('AppMapReadyDirective', () => {
  let component: AppMapReadyDirective;
  let fixture: ComponentFixture<AppMapReadyDirective>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppMapReadyDirective]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppMapReadyDirective);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
