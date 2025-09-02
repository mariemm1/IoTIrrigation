import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InsightsPanel } from './insights-panel';

describe('InsightsPanel', () => {
  let component: InsightsPanel;
  let fixture: ComponentFixture<InsightsPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InsightsPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InsightsPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
