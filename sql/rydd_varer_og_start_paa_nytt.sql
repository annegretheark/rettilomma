-- Rydder gammelt varelager, men beholder biler og ansatte.
-- Bruk denne bare hvis du vil starte med tomt og riktig lager.

delete from bil_varer;
delete from lager_bevegelser;
delete from varer;

-- Etterpå kan du legge inn varer på nytt i GUI:
-- Varer -> varenavn, innpris, påslag 3, utpris, MVA 25, antall på hovedlager.
