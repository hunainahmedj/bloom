export type Mood='natural'|'party'|'gloomy'|'cutesy';
export const MOODS:Record<Mood,{name:string;filter:string;light:string;pollen:string[];petals:string[];cadence:number;shape:number}>={
 natural:{name:'Natural',filter:'none',light:'#fffaf0',pollen:['#ffca70','#b9e6b4'],petals:['#fff3d6','#efadc1'],cadence:.65,shape:0},
 party:{name:'Party',filter:'saturate(1.35) contrast(1.08) hue-rotate(-12deg)',light:'#ffc5ef',pollen:['#fe8bcc','#8af3ff','#fce382'],petals:['#f7b0db','#bbf5ff','#ffe395'],cadence:.30,shape:1},
 gloomy:{name:'Gloomy',filter:'saturate(.38) brightness(.78) contrast(1.15)',light:'#bac8f0',pollen:['#a7c7f0','#c3a6e5'],petals:['#c0b4df','#bdcfec'],cadence:.90,shape:0},
 cutesy:{name:'Cutesy',filter:'saturate(1.12) brightness(1.08) sepia(.12)',light:'#ffe2dd',pollen:['#ff9ac9','#ffd9e4','#ffecb3'],petals:['#f5b0cb','#ffd8bb'],cadence:.48,shape:2},
};
