import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SolutionsSectionComponent } from './solutions-section.component';

describe('SolutionsSectionComponent', () => {
  let component: SolutionsSectionComponent;
  let fixture: ComponentFixture<SolutionsSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolutionsSectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SolutionsSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
