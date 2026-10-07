import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
export type PetalShape='daisy'|'rose'|'bell';
/** A closed petal volume, with soft thickness, a cupped rim and curled tip. */
export function petalGeometry(shape:PetalShape|boolean=false):BufferGeometry {
  const rose=shape===true||shape==='rose',bell=shape==='bell';
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const root=new Color(rose?'#b86680':bell?'#8b78b9':'#e4cc8d'),tip=new Color(rose?'#ffe3e5':bell?'#e6d9ff':'#fffdf1'),color=new Color();
  const rows=12,columns=4,count=(rows+1)*(columns+1);
  for(let side=0;side<2;side++)for(let i=0;i<=rows;i++){
    const s=i/rows,outline=Math.pow(Math.sin(Math.PI*s),rose?.58:bell?.40:.48)*(rose?.5:bell?.34:.23);
    for(let j=0;j<=columns;j++){
      const edge=j/columns*2-1;
      const ridge=(rose?.3:bell?.25:.11)*Math.sin(Math.PI*s),cup=edge*edge*(rose?.30:bell?.26:.13)*Math.sin(Math.PI*s);
      const curl=(rose?.40:bell?1.0:.19)*s*s*s;
      const thickness=(rose?.055:.035)*(.3+.7*Math.sin(Math.PI*s));
      positions.push(outline*edge,ridge+cup+curl+(side?-thickness:0),s);
      color.copy(root).lerp(tip,Math.min(1,s*(rose?1.3:bell?1.4:3)));if(side)color.multiplyScalar(.86);
      colors.push(color.r,color.g,color.b);
      if(i<rows&&j<columns){const n=side*count+i*(columns+1)+j,a=n,b=n+1,c=n+columns+1,d=n+columns+2;
        if(side)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);
      }
    }
  }
  const rim:number[]=[];
  for(let j=0;j<=columns;j++)rim.push(j);
  for(let i=1;i<=rows;i++)rim.push(i*(columns+1)+columns);
  for(let j=columns-1;j>=0;j--)rim.push(rows*(columns+1)+j);
  for(let i=rows-1;i>0;i--)rim.push(i*(columns+1));
  for(let i=0;i<rim.length;i++){const a=rim[i],b=rim[(i+1)%rim.length];indices.push(a,b,a+count,b,b+count,a+count);}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
