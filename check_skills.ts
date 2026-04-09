import fs from 'fs';
import { RaceSolverBuilder } from './src/uma-skill-tools/RaceSolverBuilder';
import { CourseHelpers } from './src/uma-skill-tools/CourseData';
import { HorseParameters } from './src/uma-skill-tools/HorseTypes';
import { RaceParameters } from './src/uma-skill-tools/RaceParameters';
import { Rule30CARng } from './src/uma-skill-tools/Random';
import skills from './src/uma-skill-tools/data/skill_data.json';
import skillMeta from './src/uma-skill-tools/data/skill_meta.json';

import defaultRace from './src/uma-skill-tools/data/default_race.json';

const course = CourseHelpers.getCourse(defaultRace.courseId); // Use default course (Nakayama 2000m)
const racedef: RaceParameters = {
    groundCondition: defaultRace.ground_condition,
    weather: defaultRace.weather,
    season: defaultRace.season,
    time: 1,
    orderRange: [1, 18],
    numUmas: 18
};

const wrongSkills: any[] = [];

for (const skillId in skills) {
    const skill = (skills as any)[skillId];
    const meta = (skillMeta as any)[skillId];
    
    if (!meta) continue;

    // Check if it's a speed or acceleration skill (tags 401, 402)
    const isSpeedOrAccel = meta.tags && (meta.tags.includes(401) || meta.tags.includes(402));
    if (!isSpeedOrAccel) continue;

    // Skip green skills (tag 406)
    if (meta.tags && meta.tags.includes(406)) continue;

    // Skip concentration (skillId 200011, 200012, etc.)
    if (skill.name && skill.name.includes('コンセントレーション')) continue;
    if (skill.name && skill.name.includes('集中力')) continue;

    const horse: HorseParameters = {
        speed: 1200,
        stamina: 1200,
        power: 1200,
        guts: 1200,
        wisdom: 1200,
        strategy: 1, // Runner
        distanceAptitude: 1,
        surfaceAptitude: 1,
        strategyAptitude: 1,
        skills: [{ id: parseInt(skillId), level: 1 }]
    };

    const builder = new RaceSolverBuilder(1)
        .seed(0, 0)
        .course(course)
        .ground(racedef.groundCondition)
        .weather(racedef.weather)
        .season(racedef.season)
        .time(racedef.time)
        .horse(horse)
        .pacer(horse)
        .addSkill(skillId, 1);
    
    const solver = builder.build().next().value;
    
    // Simulate
    while (!solver.isFinished()) {
        solver.tick();
    }

    const runData = solver.getRunData();
    const umaData = runData.p[0];

    // Check activations
    for (const act of umaData.activations) {
        if (act.skillId === parseInt(skillId) && act.distance === 0) {
            wrongSkills.push({
                id: skillId,
                name: skill.name,
                conditions: skill.conditions
            });
        }
    }
}

console.log(`Found ${wrongSkills.length} skills activating at 0m incorrectly.`);
fs.writeFileSync('wrong_skills.json', JSON.stringify(wrongSkills, null, 2));
