@echo off
call npm run build
call npm start -- test\unit-test.svg test\unit-test-out.svg
rem call npm start -- --extract test\test.svg test\out