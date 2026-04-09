import { RaceSolverBuilder } from './src/uma-skill-tools/RaceSolverBuilder';
import { Perspective } from './src/uma-skill-tools/RaceSolver';

async function runTest() {
    console.log("Starting Skill Activation Test...");
    
    const builder = new RaceSolverBuilder(1);
    builder.course(10001); // Tokyo 2000m
    builder.horse({
        speed: 1200,
        stamina: 1200,
        power: 1200,
        guts: 1200,
        wisdom: 1200,
        strategy: 'Senkou',
        distanceAptitude: 'A',
        surfaceAptitude: 'A',
        strategyAptitude: 'A'
    });
    
    // Add problematic skills
    builder.addSkill('100161'); // Shadow Break
    builder.addSkill('201651'); // Slipstream
    builder.addSkill('100221'); // Fairy Tale
    
    builder.useDefaultPacer();
    
    const solvers = builder.build();
    const solver = solvers.next().value;
    
    if (!solver) {
        console.error("Failed to create solver");
        return;
    }
    
    console.log("Initial state check...");
    console.log("Pending skills:", solver.pendingSkills.map(s => ({ id: s.skillId, start: s.trigger.start, end: s.trigger.end })));
    console.log("Used skills:", Array.from(solver.usedSkills));
    
    // Run a few ticks
    for (let i = 0; i < 10; i++) {
        solver.step(0.033);
        if (solver.usedSkills.size > 0) {
            console.log(`Tick ${i}, Pos: ${solver.pos.toFixed(2)}, Used skills:`, Array.from(solver.usedSkills));
        }
    }
}

runTest().catch(console.error);
